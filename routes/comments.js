var express = require('express');
var router = express.Router({ mergeParams: true });
var Campground = require('../models/campground');
var Comment = require('../models/comment');
var middleware = require('../middleware');

//Comments Create
router.post('/', middleware.isLoggedIn, function(req, res) {
	Campground.findById(req.params.id, function(err, campground) {
		if (err) {
			req.flash('error', 'Campground not found');
			return res.redirect('/campgrounds');
		} else {
			if (!req.body.comment.text) {
				req.flash('error', "You can't publish an empty comment");
				return res.redirect('/campgrounds/' + req.params.id);
			}
			Comment.create(req.body.comment, function(err, comment) {
				if (err) {
					req.flash('error', 'Something went wrong');
					return res.redirect('/campgrounds/' + campground._id);
				} else {
					comment.author.id = req.user._id;
					comment.author.username = req.user.username;
					comment.save();
					campground.comments.push(comment);
					campground.save();
					req.flash('success', 'Successfully added comment');
					res.redirect('/campgrounds/' + campground._id);
				}
			});
		}
	});
});

//COMMENT UPDATE
router.put('/:comment_id', middleware.checkCommentOwnership, function(req, res) {
	Campground.findById(req.params.id, function(err, foundCampground) {
		if (err) {
			req.flash('error', 'Campground not found');
			return res.redirect('/campgrounds');
		}
		if (!req.body.comment.text) {
			req.flash('error', "You can't publish an empty comment");
			return res.redirect('/campgrounds/' + req.params.id);
		}
		Comment.findByIdAndUpdate(req.params.comment_id, req.body.comment, function(err) {
			if (err) {
				req.flash('error', 'Something went wrong');
				return res.redirect('/campgrounds/' + req.params.id);
			} else {
				req.flash('success', 'Successfully edited comment');
				res.redirect('/campgrounds/' + req.params.id);
			}
		});
	});
});

//COMMENT DESTROY ROUTE
router.delete('/:comment_id', middleware.checkCommentOwnership, function(req, res) {
	Campground.findById(req.params.id, function(err, foundCampground) {
		if (err) {
			req.flash('error', 'Campground not found');
			return res.redirect('/campgrounds');
		}
		let commentIndex = foundCampground.comments.indexOf(req.params.comment_id);
		foundCampground.comments.splice(commentIndex, 1);
		foundCampground.save();
		Comment.deleteOne({ _id: req.params.comment_id }, function(err) {
			if (err) {
				req.flash('error', 'Something went wrong');
				return res.redirect('/campgrounds/' + req.params.id);
			} else {
				req.flash('success', 'Comment deleted');
				res.redirect('/campgrounds/' + req.params.id);
			}
		});
	});
});

module.exports = router;
