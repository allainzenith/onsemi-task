const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

async function returnFolder(folderPath) {
  try {
    const downloadFolder = path.join(process.cwd(), folderPath);
    // Ensure the download directory exists
    if (!fs.existsSync(downloadFolder)) {
      fs.mkdirSync(downloadFolder, { recursive: true });
    }

    return downloadFolder;
  } catch (error) {
    console.error(error.message);
  }
}

function writeFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, data);
    console.log("File written successfully.");
  } catch (error) {
    console.error(error.message);
  }
}

function writeFileStream(filePath, res) {
  const fileStream = fs.createWriteStream(filePath);
  res?.pipe(fileStream);

  fileStream.on("finish", () => {
    fileStream.close();
    console.log("File stream finished successfully!");
  });

  fileStream.on("error", (err) =>
    console.error("File write error:", err.message)
  );
}

function deleteFile(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log("File deleted successfully.");
  } else {
    console.log("File not found.");
  }
}

function loadCsvFileAsJson(csvPath) {
  try {
    const fileContent = fs.readFileSync(csvPath, "utf8");

    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
    });

    return records;
  } catch (error) {
    console.error(error.message);
    return null;
  }
}

async function renameFile(downloadPath, filename, newFileName) {
  try {
    const originalFile = fs
      .readdirSync(downloadPath)
      .find((file) => file === filename);
    const oldPath = path.join(downloadPath, originalFile);
    const newPath = path.join(downloadPath, `${newFileName}`);

    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
      console.log("Renamed to:", newPath);
    } else {
      console.error("File not found");
    }
  } catch (error) {
    console.error(error.message);
  }
}

module.exports = {
  returnFolder,
  renameFile,
  loadCsvFileAsJson,
  deleteFile,
  writeFile,
  writeFileStream,
};
