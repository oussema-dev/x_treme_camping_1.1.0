var express = require('express');
var router = express.Router({ mergeParams: true });
var Campground = require('../models/campground');
var Review = require('../models/review');
var middleware = require('../middleware');

//Reviews Index
router.get('/', function(req, res) {
	Campground.findById(req.params.id)
		.populate({ path: 'reviews', options: { sort: { createdAt: -1 } } })
		.exec(function(err, campground) {
			if (err) {
				req.flash('error', 'Something went wrong');
				return res.redirect('/campgrounds');
			}
			res.render('reviews/index', { campground: campground });
		});
});

//Reviews New
router.get('/new', middleware.isLoggedIn, middleware.checkReviewExistence, function(req, res) {
	Campground.findById(req.params.id, function(err, campground) {
		if (err) {
			req.flash('error', 'Something went wrong');
			return res.redirect('/campgrounds');
		}
		res.render('reviews/new', { campground: campground });
	});
});

//Reviews Create
router.post('/', middleware.isLoggedIn, middleware.checkReviewExistence, function(req, res) {
	Campground.findById(req.params.id).populate('reviews').exec(function(err, campground) {
		if (err) {
			req.flash('error', 'Something went wrong');
			return res.redirect('/campgrounds');
		}
		Review.create(req.body.review, async function(err, review) {
			if (err) {
				req.flash('error', 'Something went wrong');
				return res.redirect('/campgrounds/' + campground._id);
			}
			review.author.id = req.user._id;
			review.author.username = req.user.username;
			review.campground = campground;
			await review.save();
			campground.reviews.push(review);
			campground.rating = await calculateAverage(campground.reviews);
			await campground.save();
			req.flash('success', 'Review added successfully');
			res.redirect('/campgrounds/' + campground._id);
		});
	});
});

//Reviews Edit
router.get('/:review_id/edit', middleware.checkReviewOwnership, function(req, res) {
	Campground.findById(req.params.id, function(err, foundCampground) {
		if (err) {
			req.flash('error', 'Campground not found');
			return res.redirect('/campgrounds');
		}
		Review.findById(req.params.review_id, function(err, foundReview) {
			if (err) {
				req.flash('error', 'Something went wrong');
				return res.redirect('/campgrounds/' + req.params.id);
			}
			res.render('reviews/edit', { campground_id: req.params.id, review: foundReview });
		});
	});
});

//Reviews Update
router.put('/:review_id', middleware.checkReviewOwnership, async function(req, res) {
	try {
		await Review.findByIdAndUpdate(req.params.review_id, req.body.review, { new: true });
		let campgroundToUpdate = await Campground.findById(req.params.id).populate('reviews').exec();
		campgroundToUpdate.rating = await calculateAverage(campgroundToUpdate.reviews);
		await campgroundToUpdate.save();
		req.flash('success', 'Review updated successfully');
		res.redirect('/campgrounds/' + req.params.id);
	} catch (err) {
		req.flash('error', 'Something went wrong');
		return res.redirect('/campgrounds/' + req.params.id);
	}
});

// Reviews Delete
router.delete('/:review_id', middleware.checkReviewOwnership, function(req, res) {
	Review.findByIdAndRemove(req.params.review_id, function(err) {
		if (err) {
			req.flash('error', 'Something went wrong');
			return res.redirect('/campgrounds/' + req.params.id);
		}
		Campground.findByIdAndUpdate(req.params.id, { $pull: { reviews: req.params.review_id } }, { new: true })
			.populate('reviews')
			.exec(async function(err, campground) {
				if (err) {
					req.flash('error', 'Something went wrong');
					return res.redirect('/campgrounds');
				}
				campground.rating = calculateAverage(campground.reviews);
				await campground.save();
				req.flash('success', 'Review deleted');
				res.redirect('/campgrounds/' + req.params.id);
			});
	});
});

function calculateAverage(reviews) {
	if (reviews.length === 0) {
		return 0;
	}
	var sum = 0;
	reviews.forEach(function(element) {
		sum += element.rating;
	});
	return sum / reviews.length;
}

module.exports = router;
