const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;

const publicDir = path.join(__dirname, "public");
const uploadDir = path.join(__dirname, "uploads");
const dbPath = path.join(__dirname, "submissions.json");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify([], null, 2));
}

app.use(cors());
app.use(express.json());
app.use(express.static(publicDir));
app.use("/uploads", express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

function readSubmissions() {
  return JSON.parse(fs.readFileSync(dbPath, "utf8"));
}

function writeSubmissions(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

app.post("/api/submissions", upload.single("photo"), (req, res) => {
  try {
    const submissions = readSubmissions();
    const { name, location, context, project, notes, latitude, longitude, accuracy } = req.body;
    const photo = req.file;

    if (!photo) {
      return res.status(400).json({ error: "Photo is required" });
    }

    const submission = {
      id: Date.now().toString(),
      name: name || "",
      location: location || "",
      context: context || "",
      project: project || "",
      notes: notes || "",
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      accuracy: accuracy ? Number(accuracy) : null,
      photoFilename: photo.filename,
      photoUrl: `/uploads/${photo.filename}`,
      createdAt: new Date().toISOString()
    };

    submissions.unshift(submission);
    writeSubmissions(submissions);

    res.status(201).json({
      message: "Submission saved",
      submission
    });
  } catch (error) {
    console.error("POST /api/submissions error:", error);
    res.status(500).json({ error: "Could not save submission" });
  }
});

app.get("/api/submissions", (req, res) => {
  try {
    const submissions = readSubmissions();
    res.json(submissions);
  } catch (error) {
    console.error("GET /api/submissions error:", error);
    res.status(500).json({ error: "Could not load submissions" });
  }
});

app.get("/api/submissions/:id", (req, res) => {
  try {
    const submissions = readSubmissions();
    const submission = submissions.find(item => item.id === req.params.id);

    if (!submission) {
      return res.status(404).json({ error: "Submission not found" });
    }

    res.json(submission);
  } catch (error) {
    console.error("GET /api/submissions/:id error:", error);
    res.status(500).json({ error: "Could not load submission" });
  }
});

app.delete("/api/submissions/:id", (req, res) => {
  try {
    const submissions = readSubmissions();
    const submission = submissions.find(item => item.id === req.params.id);

    if (!submission) {
      return res.status(404).json({ error: "Submission not found" });
    }

    const imagePath = path.join(uploadDir, submission.photoFilename);

    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    const updatedSubmissions = submissions.filter(item => item.id !== req.params.id);
    writeSubmissions(updatedSubmissions);

    res.json({ message: "Submission deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/submissions/:id error:", error);
    res.status(500).json({ error: "Could not delete submission" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});