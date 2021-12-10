import  express from "express";
import { MongoClient } from "mongodb";
import dotenv from 'dotenv';
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import AWS from "aws-sdk";
import nodemailer from "nodemailer";
import multer from "multer";
import multerS3 from "multer-s3";




  
dotenv.config();

 const app = express()

 app.use(cors({
     origin: '*',
     credentials: true
 }));

app.use(express.json()) 


const PORT = process.env.PORT;  

const MONGO_URL = process.env.MONGO_URL;  

AWS.config.update({secretAccessKey: process.env.secretAccessKey,accessKeyId: process.env.accessKeyId,region: process.env.region});

export var s3 = new AWS.S3({apiVersion: '2006-03-01'});

const auth = (req,res,next) => {
    try{                                                   
        const token = req.header('x-auth-token');          
        jwt.verify(token, process.env.SECRET_KEY);          
        next();                                      
    }catch(err){
        res.status(401).send({error: err.message})          
    }  
}


app.get("/fileView/:key",(req,res) =>{

    const { key } = req.params;
     
    s3.getObject({Bucket: process.env.BUCKET_NAME, Key: key }, function(err, data)  
    {
        if (!err)
        console.log(key);
            res.setHeader('Content-type','image/png').send(data.Body);
    });
})
 
app.post("/resetPassword/:token",async (req,res) => {
    const { token } = req.params;
    const { password,email } = req.body;
    const hashedPassword = await genPassword(password);
    const userbyemail = await getUserbyName(email);
    const user = await client.db("b28wd").collection("driveUsers").findOneAndUpdate({resetLink: `${process.env.CLIENT_URL}/resetPassword/${token}`}, { $set: { password: hashedPassword }} );
    const result = await client.db("b28wd").collection("driveUsers").findOneAndUpdate({email: email}, { $unset : {resetLink: 1 } });
    if(!userbyemail){
        res.send({ message: "Password Reset not done !!"  });
        return;
    }   res.send( { message: "Password Reset successfull !! 😄"  })  

})


app.post("/forgotPassword",async (req,res) => {
    const { email } = req.body;
    const userFound = await getUserbyName(email);
    
    if(!userFound){
        res.send({message: "User does not exist !!!"});
        return;
    }
    const firstName = userFound.firstName;
    if(userFound){
        const token = jwt.sign({ email, firstName }, process.env.SECRET_KEY, { expiresIn: "20m" });
        const updateUrl = await client.db("b28wd").collection("driveUsers").findOneAndUpdate({email : email}, { $set: {resetLink : `${process.env.CLIENT_URL}/resetPassword/${token}`}});
        const options = {
            from: "chetanhc1997@hotmail.com",
            to: email,
            subject: "Password Reset Link",
            html: `<a>${process.env.CLIENT_URL}/resetPassword/${token}</a>`
        };
    
        transporter.sendMail(options, (err, info) => {
            if (err) {
                console.log(err);
                return;
            }
            console.log("Sent: " + info.response);
            
            res.send({ message: "Password reset link sent to your mail!!", email: email });
        
    });

}


})

var  upload =  multer({                                //uploading file using multer
        storage: multerS3({
            s3: s3,
            bucket: process.env.BUCKET_NAME,
            key: function (req, file, cb) {
           
                setUploadUser(file);
                cb(null, file.originalname ); 
            }
        })
    });

var filetoUpdate;

function setUploadUser(file){
    filetoUpdate = file;
}
  
app.post('/upload/:username', upload.single("image" ) ,async function (req, res, next) {       //file upload function**
    
    const { username } = req.params;
    filetoUpdate ?  await client.db("b28wd").collection("driveUsers").findOneAndUpdate({email: username}, {$push: { files: filetoUpdate.originalname  }}) : "";
    res.send({ message: "Uploaded!"} );

})
 

app.get('/download/:filekey', async function(req, res, next){

    var  fileKey = req.params.filekey;
  
    var bucketParams = {
        Bucket: process.env.BUCKET_NAME,
        Key: fileKey,
    };

    res.attachment(fileKey);
    var fileStream = s3.getObject(bucketParams).createReadStream();
    fileStream.pipe(res);

});






async function createConnection(){                      
    const client = new MongoClient(MONGO_URL);
    await client.connect();
    console.log("Mongodb connected");
    return client;
}

 const client = await createConnection();

app.get("/",(req,res) => {
    res.send("hello")
})

app.listen(PORT, () => console.log("App is started in Port",PORT));

 async function genPassword(password){
    const NO_OF_ROUNDS = 10;
    const salt = await bcrypt.genSalt(NO_OF_ROUNDS);
    const hashedPassword = await bcrypt.hash(password,salt);
    return hashedPassword;
}


 const transporter = nodemailer.createTransport({
    service: "hotmail",
    port: 587,
    secure: false,
    auth: {
      user: "chetanhc1997@hotmail.com",
      pass: process.env.MAIL_PASSWORD, 
    },
  });


 async function createUser(data) {
    return await client.db("b28wd").collection("driveUsers").insertOne(data);
}

 async function getUserbyName(username) {
    return await client.db("b28wd").collection("driveUsers").findOne({ email: username });
}




app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    const result = await client.db("b28wd").collection("driveUsers").findOneAndUpdate({email: email}, { $unset : {token: 1 } });

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

app.get("/userFiles/:username", auth, async (req, res) => {

    const { username }= req.params;

    const user = await getUserbyName(username);

    const bucketName = user.bucket;

    var bucketParams = {
        Bucket: bucketName,
    };


    s3.listObjects(bucketParams, function (err, data) {
        if (err) {
            console.log("Error", err);
        } else {
            const userFiles = user.files;
            const files = data.Contents;
        
            const filteredFiles = files.filter((file) => userFiles.includes(file.Key) )
            res.send(filteredFiles);
        }
    });

});

app.post("/activateAccount", (req, res) => {
    const { token } = req.body;

    if (token) {
        jwt.verify(token, process.env.SECRET_KEY, async function (err, decodedToken) {
            if (err) {
                return res.status(400).json({ message: "Incorrect or expired link. " });
            }
            const userActivate1 = await client.db("b28wd").collection("driveUsers").findOne({ token: token });
            const userActivate = await client.db("b28wd").collection("driveUsers").findOneAndUpdate({ token: token }, { $set: { status: "active" } });
            // const userActivate2 = await client.db("b28wd").collection("driveUsers").findOneAndUpdate({ token: token }, { $set: { files: [] } });

            res.json({ message: "Sign up successful" });


        });
    }

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
