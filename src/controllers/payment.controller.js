import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
// import {instance}  from "../app.js"
import crypto from "crypto"
import {payment} from "../models/payment.model.js"
import { Teacher } from "../models/teacher.model.js";
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// const coursePayment = asyncHandler(async(req,res)=>{
//     const {fees, } = req.body

//     if(!fees){
//       throw new ApiError(400,"fees is required")
//     }

//     const options = {
//         amount: fees,  // amount in the smallest currency unit
//         currency: "INR",
//         receipt: "order_rcptid_11"
//       };
//       // const order = await instance.orders.create(options)

//       return res
//       .status(200)
//       .json( new ApiResponse(200, order,"order fetched"))
// })


const coursePayment = asyncHandler(async (req, res) => {
  const { fees } = req.body;

  if (!fees) {
    throw new ApiError(400, "fees is required");
  }

  const amountInPaisa = fees * 100; // Stripe uses smallest currency unit

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInPaisa,
    currency: "pkr",
    metadata: {
      integration_check: "accept_a_payment"
    }
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { clientSecret: paymentIntent.client_secret }, "Stripe Payment Intent created"));
});



const getkey = asyncHandler(async(req,res)=>{
  return res
  .status(200)
  .json(new ApiResponse(200,{key:process.env.KEY_ID}, "razor key fetched"))
})


// const coursePaymentConfirmation = asyncHandler(async(req,res)=>{
//   const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
//     req.body;
  
//   const studentID = req.Student._id
//   const courseID = req.params.courseID
//   console.log(courseID)

//   const body = razorpay_order_id + "|" + razorpay_payment_id;

//   const expectedSignature = crypto
//     .createHmac("sha256", process.env.KEY_SECRET)
//     .update(body.toString())
//     .digest("hex");

//   const isAuthentic = expectedSignature === razorpay_signature;

//   if (isAuthentic) {

//     const orderDetails = await payment.create({
//       razorpay_order_id,
//       razorpay_payment_id,
//       razorpay_signature,
//       courseID, 
//       studentID,
//     });

//     return res
//     .status(200)
//     .json(new ApiResponse(200,{orderDetails}, "payment confirmed" ))
//   } else {
//     throw new ApiError(400, "payment failed")
//   }
// })


const coursePaymentConfirmation = asyncHandler(async (req, res) => {
  const { paymentIntentId } = req.body;

  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (intent.status === "succeeded") {
    const studentID = req.Student._id;
    const courseID = req.params.courseID;

    const orderDetails = await payment.create({
      razorpay_order_id: intent.id,
      razorpay_payment_id: intent.id,
      razorpay_signature: "stripe_signature_dummy",
      courseID,
      studentID
    });

    return res
      .status(200)
      .json(new ApiResponse(200, { orderDetails }, "Payment confirmed"));
  } else {
    throw new ApiError(400, "Payment not successful");
  }
});


// const TEST_MODE = true;
// const coursePaymentConfirmation = asyncHandler(async(req,res)=>{
//   const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  
//   const studentID = req.Student._id;
//   const courseID = req.params.courseID;

//   console.log(courseID);

//   const body = razorpay_order_id + "|" + razorpay_payment_id;

//   if (TEST_MODE) {
//     // In test mode, directly create payment without crypto check
//     const orderDetails = await payment.create({
//       razorpay_order_id: razorpay_order_id || "dummy_order_id",
//       razorpay_payment_id: razorpay_payment_id || "dummy_payment_id",
//       razorpay_signature: razorpay_signature || "dummy_signature",
//       courseID, 
//       studentID,
//     });

//     return res
//       .status(200)
//       .json(new ApiResponse(200, { orderDetails }, "payment confirmed in test mode"));

//   } else {
//     // Real Razorpay Signature Verification
//     const expectedSignature = crypto
//       .createHmac("sha256", process.env.KEY_SECRET)
//       .update(body.toString())
//       .digest("hex");

//     const isAuthentic = expectedSignature === razorpay_signature;

//     if (isAuthentic) {
//       const orderDetails = await payment.create({
//         razorpay_order_id,
//         razorpay_payment_id,
//         razorpay_signature,
//         courseID, 
//         studentID,
//       });

//       return res
//         .status(200)
//         .json(new ApiResponse(200, { orderDetails }, "payment confirmed"));
//     } else {
//       throw new ApiError(400, "payment failed");
//     }
//   }
// })



const teacherAmount = asyncHandler(async(req,res)=>{
  const teacher = req.teacher

  const newEnrolledStudentCount = await Teacher.aggregate([
    {
      $match: { _id: teacher._id }
    },
    {
      $unwind: "$enrolledStudent"
    },
    {
      $match: { "enrolledStudent.isNewEnrolled": true }
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 }
      }
    }
  ]);

  const count = newEnrolledStudentCount.length > 0 ? newEnrolledStudentCount[0].count : 0;


  await Teacher.findByIdAndUpdate(
    teacher._id,
    { $inc: { Balance: count * 500 } },
   
  );

  const newTeacher = await Teacher.findOneAndUpdate(
    { _id: teacher._id, "enrolledStudent.isNewEnrolled": true },
    { $set: { "enrolledStudent.$[elem].isNewEnrolled": false } },
    { 
        new: true,
        arrayFilters: [{ "elem.isNewEnrolled": true }],
    }
  );

  if(!newTeacher){
    const newTeacher = await Teacher.findById(
      teacher._id
    )

    return res
    .status(200)
    .json(new ApiResponse(200, {newTeacher}, "balance"))
  }


  return res
  .status(200)
  .json(new ApiResponse(200, {newTeacher}, "balance"))
  
})


const withdrawAmount = asyncHandler(async(req,res)=>{

  const teacherId = req.teacher._id
  const amount = req.body.amount

  console.log(amount);

  const teacher = await Teacher.findById(teacherId);

  if (!teacher) {
    return res.status(404).json({ message: "Teacher not found" });
  }

  if (teacher.Balance < amount) {
    return res.status(400).json({ message: "Insufficient balance" });
  }

  teacher.Balance -= amount;
  teacher.WithdrawalHistory.push({ amount });
  await teacher.save();

  const newTeacher = await Teacher.findById(teacherId)

  return res
  .status(200)
  .json(new ApiResponse(200, {newTeacher}, "balance"))
  
})



export {coursePayment, getkey, coursePaymentConfirmation, teacherAmount, withdrawAmount}