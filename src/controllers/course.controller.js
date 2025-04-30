import { course } from "../models/course.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Teacher } from "../models/teacher.model.js";
import { Sendmail } from "../utils/Nodemailer.js"
import mongoose from "mongoose";


const getCourse = asyncHandler(async (req, res) => {
  const courses = await course.find({ isapproved: true })
    .populate('enrolledteacher', '_id Firstname Lastname Email Experience'); // Populate the enrolledteacher field

  if (!courses || courses.length === 0) {
    throw new ApiError(404, "No courses found");
  }

  return res.status(200).json(
    new ApiResponse(200, courses, "All courses with teacher details")
  );
});


const getcourseTeacher = asyncHandler(async (req, res) => {

  const coursename = req.params.coursename;

  if (!coursename) {
    throw new ApiError(400, "Choose a course")
  }

  const courseTeachers = await course.find({ coursename, isapproved: true }).populate('enrolledteacher');



  if (!courseTeachers || courseTeachers.length === 0) {
    throw new ApiError(400, "No teachers found for the specified course");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, courseTeachers, "details fetched"))

})


const getTeacherAllCourses = asyncHandler(async (req, res) => {
  const teacherId = req.teacher._id;

  if (!teacherId) {
    throw new ApiError(400, "Teacher ID is required");
  }

  const teacherCourses = await course.find({ enrolledteacher: teacherId });

  if (!teacherCourses || teacherCourses.length === 0) {
    throw new ApiError(404, "No courses found for this teacher");
  }

  return res.status(200).json(
    new ApiResponse(200, teacherCourses, "Teacher's courses fetched successfully")
  );
});


const addCourseTeacher = asyncHandler(async (req, res) => {
  const loggedTeacher = req.teacher;
  const teacherParams = req.params.id;

  if (!teacherParams) {
    throw new ApiError(400, "Invalid user");
  }

  if (loggedTeacher._id.toString() !== teacherParams) {
    throw new ApiError(403, "Not authorized");
  }

  const { coursename, description, thumbnailimage, price } = req.body;

  if ([coursename, description, thumbnailimage].some((field) => !field || field.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }

  const newCourse = await course.create({
    coursename,
    description,
    thumbnailimage,
    price, // ✅ Added price here
    enrolledteacher: loggedTeacher._id,
  });

  if (!newCourse) {
    throw new ApiError(500, "Couldn't create course");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, { newCourse, loggedTeacher }, "New course created"));
});



const updateCourse = asyncHandler(async (req, res) => {
  const { courseId, teacherId } = req.params;
  const loggedTeacher = req.teacher;

  if (!courseId || !teacherId) {
    throw new ApiError(400, "Missing courseId or teacherId");
  }

  if (loggedTeacher._id.toString() !== teacherId) {
    throw new ApiError(403, "Unauthorized to update this course");
  }

  const courseToUpdate = await course.findById(courseId);

  if (!courseToUpdate) {
    throw new ApiError(404, "Course not found");
  }

  if (courseToUpdate.enrolledteacher.toString() !== teacherId) {
    throw new ApiError(403, "You can only update your own courses");
  }

  const { coursename, description, thumbnailimage, price } = req.body;

  // Optional: Only update provided fields
  if (coursename) courseToUpdate.coursename = coursename;
  if (description) courseToUpdate.description = description;
  if (thumbnailimage) courseToUpdate.thumbnailimage = thumbnailimage;
  if (price !== undefined) courseToUpdate.price = price;

  const updatedCourse = await courseToUpdate.save();

  return res.status(200).json(
    new ApiResponse(200, updatedCourse, "Course updated successfully")
  );
});


const addCourseStudent = asyncHandler(async (req, res) => {
  const loggedStudent = req.Student;
  const studentParams = req.params.id;

  if (!studentParams) {
    throw new ApiError(400, "No params found");
  }

  if (loggedStudent._id.toString() !== studentParams) {
    throw new ApiError(403, "Not authorized");
  }

  const courseID = req.params.courseID;

  if (!courseID) {
    throw new ApiError(400, "Select a course");
  }

  const theCourse = await course.findById(courseID);
  if (!theCourse) {
    throw new ApiError(404, "Course not found");
  }

  const alreadyEnrolled = await course.findOne({
    _id: courseID,
    enrolledStudent: loggedStudent._id,
  });

  if (alreadyEnrolled) {
    throw new ApiError(400, "Already enrolled in this course");
  }

  const selectedCourse = await course.findByIdAndUpdate(
    courseID,
    {
      $push: {
        enrolledStudent: loggedStudent._id,
      },
    },
    { new: true }
  );

  if (!selectedCourse) {
    throw new ApiError(400, "Failed to add student in course schema");
  }

  const teacherID = selectedCourse.enrolledteacher;

  const teacher = await Teacher.findByIdAndUpdate(
    teacherID,
    {
      $push: {
        enrolledStudent: loggedStudent._id,
      },
    },
    { new: true }
  );

  await Sendmail(
    loggedStudent.Email,
    `Payment Confirmation for Course Purchase`,
    `<html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h1 style="color: #4CAF50; text-align: center;">Payment Successful!</h1>
        <p style="font-size: 16px; text-align: center;">Dear ${loggedStudent.Firstname},</p>
        <p style="font-size: 16px; text-align: center;">We are pleased to inform you that your payment for the course has been successfully processed.</p>
        <p style="font-size: 16px;">You can start accessing the course immediately by logging into your account.</p>
        <p style="font-size: 16px;">Best regards,</p>
        <p style="font-size: 16px;"><strong>The Shiksharthee Team</strong></p>
        <p style="font-size: 14px;">&copy; 2025 Shiksharthee. All rights reserved.</p>
      </body>
    </html>`
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { teacher, selectedCourse, loggedStudent }, "Successfully opted into course"));
});


const enrolledcourseSTD = asyncHandler(async (req, res) => {
  const stdID = req.params.id

  if (!stdID) {
    throw new ApiError(400, "authorization failed")
  }

  if (stdID != req.Student._id) {
    throw new ApiError(400, "params and logged student id doesnt match")
  }

  const Student = await course.find({ enrolledStudent: stdID }).select("-enrolledStudent -liveClasses -enrolledteacher")

  if (!Student) {
    throw new ApiError(404, "Student not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, Student, "student and enrolled course"))

})


const enrolledcourseTeacher = asyncHandler(async (req, res) => {
  const teacherID = req.params.id

  if (!teacherID) {
    throw new ApiError(400, "authorization failed")
  }

  if (teacherID != req.teacher._id) {
    throw new ApiError(400, "params and logged teacher id doesnt match")
  }

  const teacher = await course.find({ enrolledteacher: teacherID }).select("-enrolledStudent -liveClasses -enrolledteacher")

  if (!teacher) {
    throw new ApiError(404, "teacher not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, teacher, "teacher and enrolled course"))
})

const addClass = asyncHandler(async (req, res) => {
  const { title, link, status, thumbnail, description } = req.body;

  const loggedTeacher = req.teacher;

  if ([title, link, status].some((field) => !field || field.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }

  const { courseId, teacherId } = req.params;

  const enrolledTeacher = await course.findOne({
    _id: courseId,
    enrolledteacher: teacherId,
    isapproved: true,
  });

  if (!enrolledTeacher) {
    throw new ApiError(403, "Not authorized or course not approved");
  }

  const newClass = { title, link, status, thumbnail, description };

  const updatedCourse = await course.findByIdAndUpdate(
    courseId,
    { $push: { liveClasses: newClass } },
    { new: true }
  );

  if (!updatedCourse) {
    throw new ApiError(500, "Error occurred while adding the class");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { updatedCourse, loggedTeacher },
      "Class added successfully"
    )
  );
});

const updateClass = asyncHandler(async (req, res) => {
  const { courseId, teacherId, classId } = req.params;
  const { title, link, status, thumbnail, description } = req.body;
  const loggedTeacher = req.teacher;

  // Basic validation
  if (!mongoose.Types.ObjectId.isValid(courseId) || !mongoose.Types.ObjectId.isValid(classId)) {
    throw new ApiError(400, "Invalid courseId or classId");
  }

  if (!title && !link && !status && !thumbnail && !description) {
    throw new ApiError(400, "At least one field must be provided for update");
  }

  const courseDoc = await course.findOne({
    _id: courseId,
    enrolledteacher: teacherId,
    isapproved: true,
  });

  if (!courseDoc) {
    throw new ApiError(403, "Not authorized or course not approved");
  }

  const classIndex = courseDoc.liveClasses.findIndex(cls => cls._id.toString() === classId);
  if (classIndex === -1) {
    throw new ApiError(404, "Class not found in this course");
  }

  // Update only the provided fields
  if (title) courseDoc.liveClasses[classIndex].title = title;
  if (link) courseDoc.liveClasses[classIndex].link = link;
  if (status) courseDoc.liveClasses[classIndex].status = status;
  if (thumbnail) courseDoc.liveClasses[classIndex].thumbnail = thumbnail;
  if (description) courseDoc.liveClasses[classIndex].description = description;

  await courseDoc.save();

  return res.status(200).json(
    new ApiResponse(200, courseDoc, "Class updated successfully")
  );
});
const deleteClass = asyncHandler(async (req, res) => {
  const { courseId, teacherId, classId } = req.params;
  const loggedTeacher = req.teacher;

  if (!mongoose.Types.ObjectId.isValid(courseId) || !mongoose.Types.ObjectId.isValid(classId)) {
    throw new ApiError(400, "Invalid courseId or classId");
  }

  const courseDoc = await course.findOne({
    _id: courseId,
    enrolledteacher: teacherId,
    isapproved: true,
  });

  if (!courseDoc) {
    throw new ApiError(403, "Not authorized or course not approved");
  }

  const classIndex = courseDoc.liveClasses.findIndex(cls => cls._id.toString() === classId);
  if (classIndex === -1) {
    throw new ApiError(404, "Class not found in this course");
  }

  // Remove the class
  courseDoc.liveClasses.splice(classIndex, 1);
  await courseDoc.save();

  return res.status(200).json(
    new ApiResponse(200, courseDoc, "Class deleted successfully")
  );
});




const stdEnrolledCoursesClasses = asyncHandler(async (req, res) => {
  const Student = req.Student;

  const courses = await course.aggregate([
    {
      $match: {
        enrolledStudent: Student._id
      }
    },
    {
      $project: {
        coursename: 1,
        description: 1,
        enrolledStudent: 1,
        liveClasses: 1,
        thumbnail: 1, // Add any other course details you want
      }
    },
    {
      $unwind: "$liveClasses"
    },
    {
      $group: {
        _id: "$_id", // Group by course id
        coursename: { $first: "$coursename" },
        description: { $first: "$description" },
        enrolledStudent: { $first: "$enrolledStudent" },
        thumbnail: { $first: "$thumbnail" },
        liveClasses: {
          $push: {
            title: "$liveClasses.title",
            link: "$liveClasses.link",
            status: "$liveClasses.status",
            thumbnail: "$liveClasses.thumbnail",
            description: "$liveClasses.description"
          }
        }
      }
    }
  ]);

  if (!courses || courses.length === 0) {
    throw new ApiError(404, "No classes found for the enrolled courses.");
  }

  return res.status(200).json(
    new ApiResponse(200, { Student, courses }, "Fetched courses and classes successfully")
  );
});



const teacherEnrolledCoursesClasses = asyncHandler(async (req, res) => {
  const teacher = req.teacher;

  const classes = await course.aggregate([
    {
      $match: {
        enrolledteacher: teacher._id
      }
    },
    {
      $unwind: "$liveClasses"
    },
    {
      $group: {
        _id: "classes",
        liveClasses: {
          $push: {
            coursename: "$coursename",
            title: "$liveClasses.title",
            link: "$liveClasses.link",
            status: "$liveClasses.status",
            thumbnail: "$liveClasses.thumbnail",
            description: "$liveClasses.description"
          }
        }
      }
    }
  ]);

  if (!classes || classes.length === 0) {
    throw new ApiError(404, "No classes found for the enrolled courses.");
  }

  return res.status(200).json(
    new ApiResponse(200, { teacher, classes: classes[0].liveClasses }, "Fetched classes successfully")
  );
});



const canStudentEnroll = asyncHandler(async (req, res) => {
  const loggedStudent = req.Student;
  const studentParams = req.params.id;

  // Check if the student ID from params is valid
  if (!studentParams) {
    throw new ApiError(400, "No student parameters found.");
  }

  if (loggedStudent._id != studentParams) {
    throw new ApiError(400, "Not authorized.");
  }

  const courseID = req.params.courseID;

  // Check if course ID is provided
  if (!courseID) {
    throw new ApiError(400, "Please select a course.");
  }

  // Find the course
  const thecourse = await course.findById(courseID);

  if (!thecourse) {
    throw new ApiError(400, "Course not found.");
  }

  // Check if the student is already enrolled in this course
  const alreadyEnrolled = await course.findOne({
    _id: courseID,
    enrolledStudent: loggedStudent._id,
  });

  if (alreadyEnrolled) {
    throw new ApiError(400, "You are already enrolled in this course.");
  }

  return res.status(200).json(new ApiResponse(200, {}, "Student can enroll."));
});



export { getCourse, getcourseTeacher, getTeacherAllCourses, updateClass,deleteClass, addCourseTeacher, updateCourse, addCourseStudent, enrolledcourseSTD, enrolledcourseTeacher, addClass, stdEnrolledCoursesClasses, teacherEnrolledCoursesClasses, canStudentEnroll }






