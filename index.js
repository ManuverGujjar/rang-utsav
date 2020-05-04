const express = require("express");
const port = 1111;
const app = express();
const path = require("path");
const multer = require("multer");
var session = require("express-session");
var MongoStore = require("connect-mongo")(session);
// const serveIndex = require("serve-index");
const mongoose = require("mongoose");
const User = require("./models/User");

//Connecting mongoose
mongoose.connect("mongodb://localhost/rangutsav", { useNewUrlParser: true });

var db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", function() {
  // we're connected!
  console.log("Connected to database");
});

app.use(
  session({
    secret: "work hard",
    resave: true,
    saveUninitialized: false,
    store: new MongoStore({
      mongooseConnection: db,
    }),
  })
);

//For serving static files

// app.use(
//   "/ftp",
//   express.static("public"),
//   serveIndex("public", { icons: true })
// );

app.use("/public", express.static("public"));
app.use(express.urlencoded({ extended: false })); //important for fetching data from client side
app.use(express.json());

//Setting the template engine as pug
app.set("view engine", "pug");

//Setting the views directory
app.set("views", path.join(__dirname, "templates"));

//Upload function
var storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./public/uploads");
  },
  filename: (req, file, cb) => {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});
const upload = multer({ storage: storage });

// End points

app.get("/", (req, res) => {
  res.status(200).render("main-home");
});

app.get("/register", (req, res) => {
  if (!req.session.userId) {
    res.send("Please Login First");
  } else {
    let authquery = User.findById(req.session.userId);
    authquery.exec((err, authquery) => {
      if (err) res.send(err);
      else {
        if (authquery.isSuperUser) {
          let params = {};
          let query = User.find({}, null);
          query.exec(function(err, users_querry) {
            if (err) res.send(err);
            params["users"] = users_querry;
            res.status(200).render("register-page", params);
          });
        } else {
          res.send(
            "You donot have permission to access this URL , Please Login as super user"
          );
        }
      }
    });
  }
});

var queryid = "";
app.post("/indiv-user", (req, res) => {
  queryid = req.body.individ;
  res.status(200).redirect("/indiv-user");
});

file_uploaded = false;
app.get("/indiv-user", (req, res) => {
  let params = {};
  params["file_uploaded"] = file_uploaded;
  let query = User.findById(queryid);
  query.exec(function(err, indiv_querry) {
    if (err) res.send(err);
    params["indivuser"] = indiv_querry;
    params["sessionid"] = req.session.userId;
    return res.status(200).render("indiv-user", params);
  });
});

app.post("/create-user", (req, res) => {
  sessionid = "";
  if (req.session.userId) {
    sessionid = req.session.userId;
  } else {
    res.send("Please Login First");
  }
  let authquery = User.findById(sessionid);
  authquery.exec((err, authquery) => {
    if (err) res.send(err);
    else {
      if (authquery.isSuperUser) {
        if (req.body.username && req.body.password) {
          var userData = {
            username: req.body.username,
            password: req.body.password,
            desc: req.body.desc,
            filedata: [],
          };
          if (req.body.superuser) {
            userData.isSuperUser = true;
          }
          user = new User(userData);
          user.save((err, user) => {
            if (err) {
              res.send(err);
            } else {
              return res.redirect("/register");
            }
          });
        }
      } else {
        res.send(
          "You donot have permission to access this URL , Please Login as super user"
        );
      }
    }
  });
});
app.get("/login", (req, res) => {
  if (!req.session.userId) {
    return res.status(200).render("login");
  } else {
    return res
      .status(200)
      .send(
        "Please Logout first " +
          '<br><a type="button" href="/logout">Logout</a>'
      );
  }
});

app.post("/login", (req, res) => {
  if (req.body.logusername && req.body.logpassword) {
    User.authenticate(req.body.logusername, req.body.logpassword, function(
      error,
      user
    ) {
      if (error || !user) {
        res.send(error);
      } else {
        req.session.userId = user._id;
        if (user.isSuperUser) {
          return res.redirect("/register");
        } else {
          queryid = req.session.userId;
          return res.redirect("/indiv-user");
        }
      }
    });
  } else {
    res.send("Unwanted error!!!!!");
  }
});

app.get("/client-view", function(req, res, next) {
  User.findById(req.session.userId).exec(function(error, user) {
    if (error) {
      return next(error);
    } else {
      if (user === null) {
        var err = new Error("Not authorized! Go back!");
        err.status = 400;
        return next(err);
      } else {
        return res.send(
          "<h2>Your name: </h2>" +
            user.username +
            "<h2>Your email: </h2>" +
            user.username +
            '<br><a type="button" href="/logout">Logout</a>'
        );
      }
    }
  });
});

app.get("/logout", function(req, res, next) {
  if (req.session) {
    req.session.destroy(function(err) {
      if (err) {
        return next(err);
      } else {
        return res.redirect("/login");
      }
    });
  }
});

app.post("/upload", upload.array("file", 100), (req, res) => {
  sessionid = "";
  if (req.session.userId) {
    sessionid = req.session.userId;
  } else {
    res.send("Please Login First");
  }
  let authquery = User.findById(sessionid);
  authquery.exec((err, authquery) => {
    if (err) {
      res.send(err);
    } else if (authquery.isSuperUser) {
      let query = User.findById(req.body.individ);
      file_uploaded = false;
      query.exec(function(err, file_upload_query) {
        if (err) res.send(err);
        req.files.forEach((file) => {
          file_upload_query.filedata.push(file);
          console.log("file pushed");
        });
        file_upload_query.save((err, qry) => {
          if (err) res.send(err);
          console.log("Successfully saved to database");
          queryid = req.body.individ;
          file_uploaded = true;
          return res.status(200).redirect("/indiv-user");
        });
      });
    } else {
      res.send("You donot have permission for this request");
    }
  });
});

// var userData = {
//   username: "admin",
//   password: "admin",
//   desc: "adssad",
//   filedata: [],
//   isSuperUser: true,
// };
// User.create(userData, function(error, user) {});

//Starting the server
app.listen(port, () => {
  console.log(`Started server on port ${port}`);
});
