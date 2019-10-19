var Campground = require('../models/campground');
var Comment = require('../models/comment');
var User = require('../models/user');
var Review = require('../models/review');
var middlewareObj = {};

//check if account is verified
middlewareObj.isVerified = async function(req, res, next) {
	try {
		let foundUser = await User.findOne({ username: req.body.username });
		if (!foundUser) {
			req.flash('error', 'Password or username is incorrect');
			return res.redirect('/login');
		}
		if (!foundUser.isVerified) {
			req.flash(
				'error',
				'Incorrect password or account not verified, please check your email for the account verification link'
			);
			return res.redirect('/login');
		}
		return next();
	} catch (err) {
		req.flash('error', 'Something went wrong');
		return res.redirect('/login');
	}
};

//check if user is logged in
middlewareObj.isLoggedIn = function(req, res, next) {
	if (req.isAuthenticated()) {
		return next();
	}
	req.session.redirectTo = req.originalUrl;
	req.flash('error', 'You need to be logged in to do that');
	res.redirect('/login');
};

//check if user has the permission to edit/remove a campground
middlewareObj.checkCampgroundOwnership = function(req, res, next) {
	if (req.isAuthenticated()) {
		Campground.findById(req.params.id, function(err, foundCampground) {
			if (err) {
				req.flash('error', 'Campground not found');
				return res.redirect('/campgrounds');
			} else {
				//does user own the campground?
				if (foundCampground.author.id.equals(req.user._id)) {
					next();
				} else {
					req.flash('error', "You don't have permission to do that");
					res.redirect('/campgrounds/' + req.params.id);
				}
			}
		});
	} else {
		req.session.redirectTo = req.originalUrl;
		req.flash('error', 'You need to be logged in to do that');
		res.redirect('/login');
	}
};

//check if user has the permission to edit/remove a comment
middlewareObj.checkCommentOwnership = function(req, res, next) {
	if (req.isAuthenticated()) {
		Comment.findById(req.params.comment_id, function(err, foundComment) {
			if (err) {
				req.flash('error', 'Comment not found');
				return res.redirect('/campgrounds');
			} else {
				if (foundComment.author.id.equals(req.user._id)) {
					next();
				} else {
					req.flash('error', "You don't have permission to do that");
					res.redirect('/campgrounds/' + req.params.id);
				}
			}
		});
	} else {
		req.session.redirectTo = '/campgrounds/' + req.params.id;
		req.flash('error', 'You need to be logged in to do that');
		res.redirect('/login');
	}
};

//checks if the user already reviewed the campground and disallows further actions if they did
middlewareObj.checkReviewExistence = function(req, res, next) {
	Campground.findById(req.params.id).populate('reviews').exec(function(err, foundCampground) {
		if (err) {
			req.flash('error', 'Something went wrong');
			return res.redirect('/campgrounds');
		} else {
			var foundUserReview = foundCampground.reviews.some(function(review) {
				return review.author.id.equals(req.user._id);
			});
			if (foundUserReview) {
				req.flash('error', 'You already wrote a review');
				return res.redirect('/campgrounds/' + foundCampground._id);
			}
			next();
		}
	});
};

//check if user has the permission to edit/remove a review
middlewareObj.checkReviewOwnership = function(req, res, next) {
	if (req.isAuthenticated()) {
		Review.findById(req.params.review_id, function(err, foundReview) {
			if (err) {
				req.flash('error', 'Something went wrong');
				return res.redirect('/campgrounds/' + req.params.id);
			} else {
				if (foundReview.author.id.equals(req.user._id)) {
					next();
				} else {
					req.flash('error', "You don't have permission to do that");
					res.redirect('/campgrounds/' + req.params.id);
				}
			}
		});
	} else {
		req.session.redirectTo = '/campgrounds/' + req.params.id;
		req.flash('error', 'You need to be logged in to do that');
		res.redirect('/login');
	}
};

module.exports = middlewareObj;
