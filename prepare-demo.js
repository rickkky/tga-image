const fs = require('fs');
const path = require('path');

function getImageList() {
  const dir = path.resolve(__dirname, '../demo/image');
  const files = fs.readdirSync(dir);
  const images = files.filter((file) => {
    return !file.match(/\.png$/);
  });
  return images;
}

fs.writeFileSync(
  path.resolve(__dirname, '../demo/meta.json'),
  JSON.stringify(
    {
      images: getImageList(),
    },
    null,
    2,
  ),
);
