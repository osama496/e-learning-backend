import mongoose from "mongoose";

const courseSchema = new mongoose.Schema({
  coursename: {
    type: String,
    required: true,
  },

  description: {
    type: String,
    required: true,
  },

  isapproved: {
    type: Boolean,
    default: false,
  },

  thumbnailimage: {
    type: String,
    required: true,
  },

  liveClasses: [
    {
      title: String,
      link: String,
      thumbnail: String,
      description: String,
      status: {
        type: String,
        enum: ["upcoming", "in-progress", "completed"],
        default: "upcoming",
      },
    },
  ],

  enrolledteacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "teacher",
    required: true,
  },

  enrolledStudent: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "student",
      completedClasses: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "liveClass",
        },
      ],
    },
  ],

  price: {
    type: Number,
    default: 0,
    required: true,
  },
}, { timestamps: true });

const course = mongoose.model("course", courseSchema);

export { course };
