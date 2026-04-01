const FtpDeploy = require("ftp-deploy");
const ftpDeploy = new FtpDeploy();
const path = require("path");
require("dotenv").config();

const config = {
    user: process.env.FTP_USER,
    password: process.env.FTP_PASSWORD,
    host: process.env.FTP_HOST,
    port: parseInt(process.env.FTP_PORT) || 21,
    localRoot: path.join(__dirname, "dist"),
    remoteRoot: process.env.FTP_REMOTE_ROOT || "/htdocs/",
    include: ["*", "**/*"],
    exclude: [],
    deleteRemote: false,
    forcePasv: true,
    sftp: false,
};

console.log(`🚀 Starting deployment to ${config.host}...`);
console.log(`📂 Local directory: ${config.localRoot}`);
console.log(`🌐 Remote directory: ${config.remoteRoot}`);

ftpDeploy
    .deploy(config)
    .then((res) => {
        console.log("\n✅ Deployment successful!");
        console.log("Uploaded files:", res);
    })
    .catch((err) => {
        console.error("\n❌ Deployment failed:");
        console.error(err);
        process.exit(1);
    });

// Event listeners for progress
ftpDeploy.on("uploading", function (data) {
    console.log(`Uploading (${data.transferredFileCount}/${data.totalFilesCount}): ${data.filename}`);
});
