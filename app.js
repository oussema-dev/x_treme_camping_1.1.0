//require npm packages
var express = require('express'),
	app = express(),
	session = require('express-session'),
	MongoStore = require('connect-mongo')(session),
	bodyParser = require('body-parser'),
	mongoose = require('mongoose'),
	flash = require('connect-flash'),
	passport = require('passport'),
	LocalStrategy = require('passport-local'),
	methodOverride = require('method-override'),
	User = require('./models/user');

//require routes
var campgroundRoutes = require('./routes/campgrounds'),
	commentRoutes = require('./routes/comments'),
	indexRoutes = require('./routes/index'),
	notificationRoutes = require('./routes/notifications'),
	passwordRoutes = require('./routes/password'),
	reviewRoutes = require('./routes/reviews'),
	userRoutes = require('./routes/users');

var url = process.env.DATABASEURL;
mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });

app.use(bodyParser.urlencoded({ extended: true }));
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/public'));
app.use(methodOverride('_method'));
app.use(flash());
app.locals.moment = require('moment');
app.use(
	session({
		secret: process.env.SECRET,
		resave: false,
		saveUninitialized: false,
		store: new MongoStore({ mongooseConnection: mongoose.connection }),
		cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
	})
);

//passport initialization
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
app.use(async function(req, res, next) {
	res.locals.currentUser = req.user;
	if (req.user) {
		try {
			let user = await User.findById(req.user._id).populate('notifications', null, { isRead: false }).exec();
			res.locals.notifications = user.notifications.reverse();
		} catch (err) {
			req.flash('error', 'Something went wrong');
			return res.redirect('/campgrounds');
		}
	}
	res.locals.error = req.flash('error');
	res.locals.success = req.flash('success');
	next();
});

//appending routes to their respective urls
app.use('/campgrounds', campgroundRoutes);
app.use('/campgrounds/:id/comments', commentRoutes);
app.use('/', indexRoutes);
app.use('/notifications', notificationRoutes);
app.use('/', passwordRoutes);
app.use('/campgrounds/:id/reviews', reviewRoutes);
app.use('/', userRoutes);

//start server
app.listen(process.env.PORT, process.env.IP, function() {
	console.log('Server started on port ' + process.env.PORT);
});
