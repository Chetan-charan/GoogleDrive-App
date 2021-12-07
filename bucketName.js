import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { app, getUserbyName } from "./index";

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
export let bucketName = "node-sdk-sample-55d165ac-9908-4406-807b-25e80726dc81";
app.post("/bucketName/:bucketName", (req, res) => {

    bucketName = req.params;
    res.send({ message: "bucket name updated" });

});
