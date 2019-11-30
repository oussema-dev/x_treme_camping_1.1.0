var express = require('express');
var router = express.Router();
var User = require('../models/user');
var async = require('async');
var nodemailer = require('nodemailer');
var { google } = require('googleapis');
var OAuth2 = google.auth.OAuth2;
var crypto = require('crypto');
var oauth2Client = new OAuth2(
	process.env.CLIENT_ID,
	process.env.CLIENT_SECRET,
	'https://developers.google.com/oauthplayground'
);
oauth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });
var accessToken = oauth2Client.getAccessToken();

router.get('/forgot', function(req, res) {
	res.render('forgot');
});

router.post('/forgot', function(req, res, next) {
	async.waterfall(
		[
			function(done) {
				crypto.randomBytes(20, function(err, buf) {
					var token = buf.toString('hex');
					done(err, token);
				});
			},
			function(token, done) {
				User.findOne({ email: req.body.email }, function(err, user) {
					if (err) {
						req.flash('error', 'No account linked to that email address');
						return res.redirect('/forgot');
					}
					user.resetPasswordToken = token;
					//set expiration after 1 hour
					user.resetPasswordExpires = Date.now() + 3600000;
					user.save(function(err) {
						if (err) {
							req.flash('error', 'Something went wrong');
							return res.redirect('/forgot');
						}
						done(err, token, user);
					});
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
					subject: 'Password Reset',
					text:
						'You are receiving this email because you have requested to reset ' +
						'the password of your account.\n\n' +
						'Please click on the following link, or paste it into your browser to complete the process:\n\n' +
						'https://' +
						req.headers.host +
						'/reset/' +
						token +
						'\n\n' +
						'If you did not request this, please ignore this email and your password will remain unchanged.\n'
				};
				smtpTransport.sendMail(mailOptions, function(err) {
					if (err) {
						req.flash('error', 'Something went wrong');
						return res.redirect('/forgot');
					}
					smtpTransport.close();
					done(err, user.email, 'done');
				});
			}
		],
		function(err, email) {
			if (err) {
				req.flash('error', 'Something went wrong');
				return res.redirect('/forgot');
			} else {
				req.flash('success', 'An e-mail has been sent to ' + email + ' with further instructions.');
				return res.redirect('/forgot');
			}
		}
	);
});

//find user having the requested token
router.get('/reset/:token', function(req, res) {
	User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(
		err,
		user
	) {
		if (err) {
			req.flash('error', 'Password reset token is invalid or has expired');
			return res.redirect('/forgot');
		}
		res.render('reset', { token: req.params.token });
	});
});

//reset password
router.post('/reset/:token', function(req, res) {
	async.waterfall(
		[
			function(done) {
				User.findOne(
					{ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } },
					function(err, user) {
						if (err) {
							req.flash('error', 'Password reset token is invalid or has expired');
							return res.redirect('/forgot');
						}
						if (!req.body.password) {
							req.flash('error', 'Please enter a password');
							return res.redirect('/reset/' + req.params.token);
						}
						if (req.body.password === req.body.confirm) {
							user.setPassword(req.body.password, function(err) {
								if (err) {
									req.flash('error', 'Something went wrong');
									return res.redirect('/forgot');
								} else {
									user.resetPasswordToken = undefined;
									user.resetPasswordExpires = undefined;
									user.save(function(err) {
										if (err) {
											req.flash('error', 'Something went wrong');
											return res.redirect('/forgot');
										}
										req.logIn(user, function(err) {
											if (err) {
												req.flash('error', 'Something went wrong');
												return res.redirect('/forgot');
											}
											done(err, user);
										});
									});
								}
							});
						} else {
							req.flash('error', 'Passwords do not match.');
							return res.redirect('back');
						}
					}
				);
			},
			function(user, done) {
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
					subject: 'Password Changed',
					text:
						'Hello,\n\n' +
						'This is a confirmation that the password of your account ' +
						user.email +
						' has been changed.\n'
				};
				smtpTransport.sendMail(mailOptions, function(err) {
					if (err) {
						req.flash('error', 'Something went wrong');
						return res.redirect('/forgot');
					}
					smtpTransport.close();
					done(err);
				});
			}
		],
		function(err) {
			if (err) {
				req.flash('error', 'Something went wrong');
				return res.redirect('/forgot');
			} else {
				req.flash('success', 'Password changed successfully.');
				return res.redirect('/campgrounds');
			}
		}
	);
});

module.exports = router;
