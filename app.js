//jshint esversion:6

require('dotenv').config()
const express = require("express")
const bodyParser = require("body-parser")
const ejs = require("ejs")
const mongoose = require("mongoose")
const session = require('express-session')
const passport = require('passport')
const passportMongoose = require('passport-local-mongoose')
const GoogleStrategy = require('passport-google-oauth2')
const FacebookStrategy = require('passport-facebook').Strategy
const findOrCreate = require('mongoose-findorcreate')

const app = express()

app.use(express.static("public"))
app.set('view engine', 'ejs')
app.use(bodyParser.urlencoded({extended: true}))

app.use(session({
    secret: "This is the new secret for this app",
    resave: false,
    saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

app.get("/", function(req, res){
    res.render("home")
})

mongoose.connect("mongodb://localhost:27017/userDB", {useNewUrlParser: true, useUnifiedTopology: true});
mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    facebookId: String,
    secret: String
});

userSchema.plugin(passportMongoose);
userSchema.plugin(findOrCreate)

//userSchema.plugin(encrypt, {secret: process.env.SECRET, encryptedFields: ['password']});

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy())

passport.serializeUser(function(user, done) {
    done(null, user.id);
  });
  
passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        done(err, user);
    });
});

// Signing in with Google
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oath2/v3/userinfo",
   // passReqToCallback   : true
  },
  function(accessToken, refreshToken, profile, cb) {

    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));



//login/register using Google OAuth
app.get("/auth/google",
    passport.authenticate("google", {scope: ['profile']})
)

app.get("/auth/google/secrets",
    passport.authenticate("google", {failureRedirect: '/login'}),
    function(req, res){
        res.redirect('/secrets')
    }
)


//signing in with facebook
passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/secrets",
    profileFields: ["email", "name"]
  },
  function(accessToken, refreshToken, profile, cb) {

    User.findOrCreate({ facebookId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }

//   function(accessToken, refreshToken, profile, done){
//       const {email, first_name, last_name} = profile._json;
//       const userData = {
//           email,
//           firstName: first_name,
//           lastName: last_name
//       };
//       new User(userData).save();
//       done(null, profile)
  
));

app.get("/auth/facebook", passport.authenticate("facebook"))

app.get("/auth/facebook/secrets",
    passport.authenticate("facebook", {failureRedirect: '/login'}),
    function(req, res){
        res.redirect('/secrets')
    }
)


//logs in existing user
app.get("/login", function(req, res){
    res.render("login")
})

//creates new users
app.get("/register", function(req, res){
    res.render("register")
})


//renders secrets page
app.get("/secrets", function(req, res){
    User.find({"secret": {$ne: null}}, function(err, foundUsers){
        
        if(err){
            console.log(err)
        }else{
            if(foundUsers){
                res.render("secrets", {usersWithSecrets: foundUsers})
            }
        }
    })

})

app.get("/submit", function(req, res){
    if(req.isAuthenticated()){
        res.render("submit")
     }else{
        res.redirect("/login")
    }
})

app.post("/submit", function(req, res){
    const submittedSecret = req.body.secret;

    User.findById(req.user.id, function(err, foundUser){
      if (err) {
        console.log(err);
      } else {
        if (foundUser) {
          foundUser.secret = submittedSecret;
          foundUser.save(function(){
            res.redirect("/secrets");
          });
        }
      }
    });
  });

app.get("/logout", function(req, res){
    req.logout()
    res.redirect("/")
})

app.post("/register", function(req, res){

    User.register({username: req.body.username}, req.body.password, function(err, user){
        if (err) {
        console.log(err);
        res.redirect("/register");
        } else {
        passport.authenticate("local")(req, res, function(){
            res.redirect("/secrets");
        });
        }
    });
    
});

app.post("/login", function(req, res){

const user = new User({
    username: req.body.username,
    password: req.body.password
});

req.login(user, function(err){
    if (err) {
    console.log(err);
    } else {
    passport.authenticate("local")(req, res, function(){
        res.redirect("/secrets");
    });
    }
});

});
      


app.listen(3000, function(){
    console.log("Server running on port 3000")
})

// code used when using encryption & saltrounds

//const encrypt = require("mongoose-encryption")
//const md5 = require("md5")
// const bcrypt = require("bcrypt")
// const saltRounds = 10;


//app.post("/register", function(req, res){

    // bcrypt.hash(req.body.password, saltRounds, function(err, hash){

    //     const newUser = new User({
    //         email: req.body.username,
    //         password: hash
    //     })
    
    //     newUser.save(function(err){
    //         if(err){
    //             console.log(err)
    //         }else{
    //             res.render("secrets")
    //         }
    //     })

    // })



//})

//app.post("/login", function(req, res){
    // const username = req.body.username
    // const password = req.body.password

    // User.findOne({email: username}, function(err, foundUser){
    //     if(err){
    //         console.log(err)
    //     }else{
    //         if(foundUser){
    //             bcrypt.compare(password, foundUser.password, function(err, result){
    //                 if(result === true){
    //                     res.render("secrets")

    //                 }
    //             })
    //           }
    //         }
    //     })
//    })


    // if(req.isAuthenticated()){
    //     res.render("secrets")
    //     //console.log("checkout the secrets")
    // }else{
    //     res.redirect("/login")
    //     console.log("something isn't right")
    // }