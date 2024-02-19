import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { createClient } from "redis";
import dotenv from "dotenv";
import fetch from "node-fetch"; // Assuming you're using node-fetch for server-to-server requests

dotenv.config();

const app = express();

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  }),
);

app.use(passport.initialize());
app.use(passport.session());

// Redis setup
const redisClient = createClient({
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
});

redisClient.on("error", (err) => console.log("Redis Client Error", err));
redisClient.connect();

// Passport Google OAuth2 setup
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      // Here you would typically save the profile and tokens to your database.
      // For demonstration, let's save the accessToken to Redis.
      await redisClient.set(`user:${profile.id}:accessToken`, accessToken);
      done(null, profile);
    },
  ),
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email", "https://www.googleapis.com/auth/spreadsheets"],
  }),
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  async (req, res) => {
    // Successful authentication
    // Optionally, notify your Custom GPT or another service
    const userProfile = req.user;
    console.log(JSON.stringify(req.user));
    await notifyCustomGPT(userProfile);
    res.redirect("/");
  },
);

async function notifyCustomGPT(userProfile) {
  // Placeholder for your Custom GPT notification logic
  // Example: POST request to a Custom GPT callback URL
  const callbackUrl = process.env.CUSTOM_GPT_CALLBACK_URL; // Ensure you have this in your .env
  try {
    const response = await fetch(callbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: userProfile.id,
        message: "User authenticated with Google OAuth",
        // Include any other relevant information
      }),
    });
    const data = await response.json();
    console.log("Custom GPT notified:", data);
  } catch (error) {
    console.error("Error notifying Custom GPT:", error);
  }
}

app.listen(3000, () => {
  console.log("Express server initialized");
});
