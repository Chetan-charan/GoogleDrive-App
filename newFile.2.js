import jwt from "jsonwebtoken";
import AWS from "aws-sdk";
import uuid from "uuid";
import { app, client } from "./index";

app.post("/activateAccount", (req, res) => {
    const { token } = req.body;

    if (token) {
        jwt.verify(token, process.env.SECRET_KEY, async function (err, decodedToken) {
            if (err) {
                return res.status(400).json({ message: "Incorrect or expired link. " });
            }
            const userActivate1 = await client.db("b28wd").collection("driveUsers").findOne({ token: token });
            const userActivate = await client.db("b28wd").collection("driveUsers").findOneAndUpdate({ token: token }, { $set: { status: "active" } });

            res.json({ message: "Sign up successful" });

            var bucketName = userActivate1.lastName + uuid.v4();
            var keyName = 'hello_world2.txt';

            var bucketPromise = new AWS.S3({ apiVersion: '2006-03-01' }).createBucket({ Bucket: bucketName }).promise();
            const result2 = await client.db("b28wd").collection("driveUsers").findOneAndUpdate({ email: userActivate1.email }, { $set: { bucket: bucketName } });
            bucketPromise.then(
                function (data) {

                    var objectParams = { Bucket: bucketName, Key: keyName, Body: 'Hello World!' };

                    var uploadPromise = new AWS.S3({ apiVersion: '2006-03-01' }).putObject(objectParams).promise();
                    uploadPromise.then(
                        function (data) {
                            console.log("Successfully uploaded data ");
                        });
                }).catch(
                    function (err) {
                        console.error(err, err.stack);
                    });


        });
    }

});
