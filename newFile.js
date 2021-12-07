import jwt from "jsonwebtoken";
import { app, getUserbyName, genPassword, createUser, transporter } from "./index";

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
