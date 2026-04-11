const fs = require('fs');
const path = require('path');
const uploadDir = path.join(__dirname, 'backend/uploads');
console.log('Target path:', uploadDir);
if (!fs.existsSync(uploadDir)) {
    console.log('Dir does not exist, creating...');
    fs.mkdirSync(uploadDir, { recursive: true });
}
const testFile = path.join(uploadDir, 'test.txt');
fs.writeFileSync(testFile, 'Hello Galineo');
console.log('File created at:', testFile);
console.log('Exists now?', fs.existsSync(testFile));
