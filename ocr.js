const Tesseract = require("tesseract.js");

async function runOCR() {
  const imageUrl = "http://localhost:3000/sample.png";

  console.log("Starting OCR...");

  const result = await Tesseract.recognize(
    imageUrl,
    "eng",
    {
      logger: (m) => console.log(m.status, m.progress),
    }
  );

  console.log("\n===== OCR RESULT =====\n");
  console.log(result.data.text);
}

runOCR();