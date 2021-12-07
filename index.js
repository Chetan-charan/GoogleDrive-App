import  express from "express";
import { MongoClient } from "mongodb";
import dotenv from 'dotenv';
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import AWS from "aws-sdk";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import multer from "multer";
import multerS3 from "multer-s3";


  
dotenv.config();

export const app = express()

app.use(express.json()) 

app.use(cors());            

const PORT = process.env.PORT;  

const MONGO_URL = process.env.MONGO_URL;  



AWS.config.update({secretAccessKey: process.env.secretAccessKey,accessKeyId: process.env.accessKeyId,region: process.env.region});


export var s3 = new AWS.S3({apiVersion: '2006-03-01'});

let bucketName = "node-sdk-sample-55d165ac-9908-4406-807b-25e80726dc81";
app.post("/bucketName/:bucketName", (req, res) => {

    bucketName = req.params;
    res.send({ message: "bucket name updated" });

});

  s3.getObject({Bucket: 'node-sdk-sample-55d165ac-9908-4406-807b-25e80726dc81', Key: 'hello_world.txt'}, function(err, data)
  {
      if (!err)
          console.log(data.Body.toString());
  });

    var upload = multer({
        storage: multerS3({
            s3: s3,
            bucket: bucketName,
            key: function (req, file, cb) {
                console.log(file);
                cb(null, file.originalname); 
            }
        })
    });

   
app.post('/upload', upload.single("image") , function (req, res, next) {       //file upload function**
    
    res.send("Uploaded!");
})
 

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
//   const uploadFile = (filePath,bucketName,keyName) => {
  
//     const file = fs.readFileSync(filePath);

//     // Setting up S3 upload parameters
//     const uploadParams = {
//         Bucket: bucketName, // Bucket into which you want to upload file
//         Key: keyName, // Name by which you want to save it
//         Body: file // Local file 
//     };

//     s3.upload(uploadParams, function(err, data) {
//         if (err) {
//             console.log("Error", err);
//         } 
//         if (data) {
//             console.log("Upload Success", data.Location);
//         }
//     });
// };

 //uploadFile("file1.txt","node-sdk-sample-55d165ac-9908-4406-807b-25e80726dc81","file2.txt");
//

export const auth = (req,res,next) => {
    try{                                                   
        const token = req.header('x-auth-token');          
        jwt.verify(token, process.env.SECRET_KEY);          
        next();                                      
    }catch(err){
        res.status(401).send({error: err.message})          
    }
          
    
}



async function createConnection(){                      
    const client = new MongoClient(MONGO_URL);
    await client.connect();
    console.log("Mongodb connected");
    return client;
}

export const client = await createConnection();

app.get("/",(req,res) => {
    res.send("hello")
})

app.listen(PORT, () => console.log("App is started in Port",PORT));

export async function genPassword(password){
    const NO_OF_ROUNDS = 10;
    const salt = await bcrypt.genSalt(NO_OF_ROUNDS);
    const hashedPassword = await bcrypt.hash(password,salt);
    return hashedPassword;
}


app.get("/users",async (req,res) => {
    const users = await getUsers();
    res.send(users);
})



export const transporter = nodemailer.createTransport({
    service: "hotmail",
    port: 587,
    secure: false,
    auth: {
      user: "chetanhc1997@hotmail.com",
      pass: process.env.MAIL_PASSWORD, 
    },
  });

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

app.post("/signup", async (req, res) => {
    const { email, firstName, lastName, password } = req.body;
    const user = await getUserbyName(email);
    if (user) {
        res.status(401).send({ message: "User already exists" });
        return;
    }
    if (password.length < 8) {
        res.send({ message: "password must be longer" });
        return; //so that execution stops here and doesnt go furthur
    }
    const hashedPassword = await genPassword(password);



    const token = jwt.sign({ email, firstName, lastName }, process.env.SECRET_KEY, { expiresIn: "20m" });

    const result = await createUser({ email: email, password: hashedPassword, firstName: firstName, lastName: lastName, token: token, status: "inactive" });

    const options = {
        from: "chetanhc1997@hotmail.com",
        to: email,
        subject: "Google Drive Activation Link",
        html: `<a>${process.env.CLIENT_URL}/activate/${token}</a>`
    };

    transporter.sendMail(options, (err, info) => {
        if (err) {
            console.log(err);
            return;
        }
        console.log("Sent: " + info.response);
        res.send({ message: "Email has been sent, kindly activate your account!!" });
    });
});

app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    const user = await getUserbyName(email);
    if (!user) { //if user doesnt exist
        res.status(401).send({ message: "Invalid credentials", success: "false" });
        return;
    }
    const storedPassword = user.password;
    if (user.status !== "active") {
        res.send(401).send({ message: "User is not activate !!!", success: "false" });
        return;
    }
    const firstName = user.firstName;
    const lastName = user.lastName;
    const isPasswordMatch = await bcrypt.compare(password, storedPassword);
    if (isPasswordMatch) {
        const token = jwt.sign({ email, firstName, lastName }, process.env.SECRET_KEY); //id - give a unique value  //issue token only when password is matched
        res.send({ message: "Successfully logged In !!!", token: token }); //use this token in frontend         
    } else {
        res.status(401).send({ message: "Invalid Credentials", success: "false" }); //if password is wrong
    }

});



export async function createUser(data) {
    return await client.db("b28wd").collection("driveUsers").insertOne(data);
}

export async function getUserbyName(username) {
    return await client.db("b28wd").collection("driveUsers").findOne({ email: username });
}

async function getUsers() {
    return await client.db("b28wd").collection("driveUsers").find().toArray();   //convert cursor to array
}



