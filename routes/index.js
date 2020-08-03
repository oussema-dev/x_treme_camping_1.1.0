var express = require('express');
var router = express.Router();
var passport = require('passport');
var User = require('../models/user');
var async = require('async');
var nodemailer = require('nodemailer');
var { google } = require('googleapis');
var OAuth2 = google.auth.OAuth2;
var crypto = require('crypto');
var middleware = require('../middleware');
var oauth2Client = new OAuth2(
	process.env.CLIENT_ID,
	process.env.CLIENT_SECRET,
	'https://developers.google.com/oauthplayground'
);
oauth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });
var accessToken = oauth2Client.getAccessToken();

//root route
router.get('/', function(req, res) {
	res.render('landing');
});

//show register form
router.get('/register', function(req, res) {
	res.render('register', { page: 'register' });
});

//handle sign up logic
router.post('/register', function(req, res) {
	//validate fields
	if (!req.body.username) {
		req.flash('error', 'Please enter a username');
		return res.redirect('/register');
	}
	if (!req.body.password) {
		req.flash('error', 'Please enter a password');
		return res.redirect('/register');
	}
	if (!req.body.firstName) {
		req.flash('error', 'Please enter your first name');
		return res.redirect('/register');
	}
	if (!req.body.lastName) {
		req.flash('error', 'Please enter your last name');
		return res.redirect('/register');
	}
	if (
		!req.body.email.match(
			/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
		)
	) {
		req.flash('error', 'Not a valid email address');
		return res.redirect('/register');
	}
	var newUser = new User({
		username: req.body.username,
		firstName: req.body.firstName,
		lastName: req.body.lastName,
		email: req.body.email,
		profilePicture: 'https://cnam.ca/wp-content/uploads/2018/06/default-profile.gif'
	});
	User.register(newUser, req.body.password, function(err, user) {
		if (err) {
			return res.render('register', { error: err.message, page: 'register' });
		}
		async.waterfall(
			[
				function(done) {
					crypto.randomBytes(20, function(err, buf) {
						var token = user.username + buf.toString('hex');
						done(err, token);
					});
				},
				function(token, done) {
					user.verificationToken = token;
					user.save(function(err) {
						if (err) {
							req.flash('error', 'Something went wrong');
							return res.redirect('/register');
						}
						done(err, token, user);
					});
				},
				function(token, user, done) {
					var smtpTransport = nodemailer.createTransport({
						service: 'gmail',
						auth: {
							type: 'OAuth2',
							user: process.env.MAILADDR,
							clientId: process.env.CLIENT_ID,
							clientSecret: process.env.CLIENT_SECRET,
							refreshToken: process.env.REFRESH_TOKEN,
							accessToken: accessToken
						}
					});
					var mailOptions = {
						to: user.email,
						from: process.env.MAILADDR,
						subject: 'Account verification',
						text:
							'You are receiving this email in order to verify your account.\n\n' +
							'Please click on the following link, or paste it into your browser to complete the process:\n\n' +
							'https://' +
							req.headers.host +
							'/verify/' +
							token +
							'\n\n'
					};
					smtpTransport.sendMail(mailOptions, function(err) {
						if (err) {
							req.flash('error', 'Something went wrong');
							return res.redirect('/register');
						}
						smtpTransport.close();
						done(err, user.email, 'done');
					});
				}
			],
			function(err, email) {
				if (err) {
					req.flash('error', 'Something went wrong');
					return res.redirect('/register');
				} else {
					req.flash(
						'success',
						'Your account has been successfully registered, please check you email (' +
							email +
							') to complete verification'
					);
					return res.redirect('/login');
				}
			}
		);
	});
});

//verify the account using tokens
router.get('/verify/:token', function(req, res) {
	User.findOne({ verificationToken: req.params.token }, function(err, user) {
		if (err) {
			req.flash('error', 'Invalid verification link');
			return res.redirect('/register');
		}
		user.isVerified = true;
		user.save(function(err) {
			if (err) {
				req.flash('error', 'Something went wrong');
				return res.redirect('/register');
			}
			req.logIn(user, (err) => {
				if (err) {
					req.flash('error', 'Something went wrong');
					return res.redirect('/register');
				}
				req.flash('success', 'Account verified sucessfully');
				return res.redirect('/campgrounds');
			});
		});
	});
});

//show login form
router.get('/login', function(req, res) {
	res.render('login', { page: 'login' });
});

router.post(
	'/login',
	middleware.isVerified,
	passport.authenticate('local', {
		failureFlash: true,
		failureRedirect: '/login'
	}),
	function(req, res) {
		let returnTo = req.session.redirectTo ? req.session.redirectTo : '/campgrounds';
		delete req.session.redirectTo;
		req.flash('success', 'Welcome Back');
		res.redirect(returnTo);
	}
);

//logout route
router.get('/logout', function(req, res) {
	req.logout();
	res.redirect('/campgrounds');
});

module.exports = router;
