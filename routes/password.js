var express = require('express');
var router = express.Router();
var User = require('../models/user');
var async = require('async');
var nodemailer = require('nodemailer');
var crypto = require('crypto');

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
				var Transport = nodemailer.createTransport({
					service: 'Gmail',
					auth: {
						user: process.env.MAILADDR,
						pass: process.env.MAILPWD
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
				Transport.sendMail(mailOptions, function(err) {
					if (err) {
						req.flash('error', 'Something went wrong');
						return res.redirect('/forgot');
					}
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
				var Transport = nodemailer.createTransport({
					service: 'Gmail',
					auth: {
						user: process.env.MAILADDR,
						pass: process.env.MAILPWD
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
				Transport.sendMail(mailOptions, function(err) {
					if (err) {
						req.flash('error', 'Something went wrong');
						return res.redirect('/forgot');
					}
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
