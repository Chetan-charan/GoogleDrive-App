import { app, auth, getUserbyName, s3 } from "./index";

app.get("/userFiles/:username", auth, async (req, res) => {

    const username = req.params;

    const user = await getUserbyName(username.username);

    const bucketName = user.bucket;

    var bucketParams = {
        Bucket: bucketName,
    };


    s3.listObjects(bucketParams, function (err, data) {
        if (err) {
            console.log("Error", err);
        } else {
            res.send(data);
        }
    });

});
