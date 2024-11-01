require('dotenv').config();
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;
const bodyParser = require("body-parser");

const port = process.env.PORT;

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

app.use(express.json());
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));

// Database connection with mongoose
mongoose.connect(process.env.MONGODB_URL);

// App Creation
app.get("/", (req, res) => {
  res.send("Express App is Running");
});

// Schema for creating products
const Product = mongoose.model("Product", {
  id: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  new_price: {
    type: Number,
    required: true,
  },
  old_price: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  available: {
    type: Boolean,
    default: true,
  },
});

// Endpoint to upload image to Cloudinary
app.post("/upload", async (req, res) => {
  try {
    const fileStr = req.body.image;

    // Upload image to Cloudinary
    const uploadedResponse = await cloudinary.uploader.upload(fileStr, {
      folder: "ecommerce_images",
    });

    res.json({
      success: true,
      image_url: uploadedResponse.secure_url, // URL for the uploaded image
    });
  } catch (error) {
    console.error("Image upload error:", error);
    res.status(500).json({ success: false, message: "Image upload failed" });
  }
});

// Endpoint to add products to the database
app.post("/addproduct", async (req, res) => {
  let products = await Product.find({});
  let id = products.length > 0 ? products[products.length - 1].id + 1 : 1;

  const product = new Product({
    id: id,
    name: req.body.name,
    image: req.body.image,
    category: req.body.category,
    new_price: req.body.new_price,
    old_price: req.body.old_price,
  });
  
  await product.save();
  res.json({
    success: true,
    name: req.body.name,
  });
});

// Endpoint to delete products
app.post("/removeproduct", async (req, res) => {
  await Product.findOneAndDelete({ id: req.body.id });
  res.json({
    success: true,
    name: req.body.name,
  });
});

// Endpoint to get all products
app.get("/allproducts", async (req, res) => {
  const products = await Product.find({});
  res.send(products);
});

// User schema
const Users = mongoose.model("Users", {
  name: String,
  email: { type: String, unique: true },
  password: String,
  cartData: Object,
  date: { type: Date, default: Date.now },
});

// Register user
app.post("/signup", async (req, res) => {
  const existingUser = await Users.findOne({ email: req.body.email });
  if (existingUser) {
    return res.status(400).json({ success: false, errors: "Email already in use" });
  }

  const cart = Array.from({ length: 300 }, () => 0).reduce((obj, val, idx) => {
    obj[idx] = val;
    return obj;
  }, {});

  const user = new Users({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    cartData: cart,
  });

  await user.save();
  const token = jwt.sign({ user: { id: user.id } }, process.env.JWT_SECRET);
  res.json({ success: true, token });
});

// User login
app.post("/login", async (req, res) => {
  const user = await Users.findOne({ email: req.body.email });
  if (user && user.password === req.body.password) {
    const token = jwt.sign({ user: { id: user.id } }, process.env.JWT_SECRET);
    res.json({ success: true, token });
  } else {
    res.json({ success: false, errors: "Invalid email or password" });
  }
});

// Middleware to verify user token
const fetchUser = async (req, res, next) => {
  const token = req.header("auth-token");
  if (!token) return res.status(401).send({ errors: "Please authenticate" });

  try {
    const data = jwt.verify(token, process.env.JWT_SECRET);
    req.user = data.user;
    next();
  } catch {
    res.status(401).send({ errors: "Invalid token" });
  }
};

// Cart endpoints
app.post("/addtocart", fetchUser, async (req, res) => {
  let user = await Users.findById(req.user.id);
  user.cartData[req.body.itemId] += 1;
  await user.save();
  res.send("Added to cart");
});

app.post("/removefromcart", fetchUser, async (req, res) => {
  let user = await Users.findById(req.user.id);
  if (user.cartData[req.body.itemId] > 0) user.cartData[req.body.itemId] -= 1;
  await user.save();
  res.send("Removed from cart");
});

app.post("/getcart", fetchUser, async (req, res) => {
  let user = await Users.findById(req.user.id);
  if (user) res.json(user.cartData);
  else res.status(404).json({ message: "User not found" });
});

// Starting the server
app.listen(port, () => {
  console.log("Server running on port " + port);
});
