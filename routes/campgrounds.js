var express = require('express');
var openGeocoder = require('node-open-geocoder');
var router = express.Router();
var Campground = require('../models/campground');
var User = require('../models/user');
var Notification = require('../models/notification');
var middleware = require('../middleware');
var multer = require('multer');

//this variable is to create a custom name for each file we upload
var storage = multer.diskStorage({
	filename: function(req, file, callback) {
		//adding a timestamp to the filename inorder to make it unique
		callback(null, Date.now() + file.originalname);
	}
});

//allow only image files to be uploaded using a regular expression
var imageFilter = function(req, file, callback) {
	if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
		return callback(new Error('Only image files are allowed!'), false);
	}
	callback(null, true);
};

var upload = multer({ storage: storage, limits: { fileSize: 5000000 }, fileFilter: imageFilter }).single('image');

//middleware to check file to upload
function imageUpload(req, res, next) {
	upload(req, res, function(err) {
		if (err instanceof multer.MulterError) {
			req.flash('error', err.message);
			return res.redirect('back');
		} else if (err) {
			req.flash('error', 'Only image files are allowed');
			return res.redirect('back');
		}
		return next();
	});
}

var cloudinary = require('cloudinary');
cloudinary.config({
	cloud_name: process.env.CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET
});

function escapeRegex(text) {
	return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}
//INDEX - show all campgrounds
router.get('/', function(req, res) {
	var perPage = 8;
	var pageQuery = parseInt(req.query.page);
	var pageNumber = pageQuery ? pageQuery : 1;
	var noMatch = null;
	if (req.query.search) {
		var regex = new RegExp(escapeRegex(req.query.search), 'gi');
		Campground.find({ name: regex })
			.skip(perPage * pageNumber - perPage)
			.limit(perPage)
			.exec(function(err, allCampgrounds) {
				if (err) {
					req.flash('error', 'Something went wrong');
					return res.redirect('/campgrounds');
				} else {
					Campground.countDocuments({ name: regex }).exec(function(err, count) {
						if (err) {
							req.flash('error', 'Something went wrong');
							return res.redirect('/campgrounds');
						}
						if (allCampgrounds.length < 1) {
							noMatch = 'No Campgrounds Found';
						}
						res.render('campgrounds/index', {
							campgrounds: allCampgrounds,
							noMatch: noMatch,
							page: 'campgrounds',
							current: pageNumber,
							pages: Math.ceil(count / perPage),
							search: req.query.search
						});
					});
				}
			});
	} else {
		Campground.find({}).skip(perPage * pageNumber - perPage).limit(perPage).exec(function(err, allCampgrounds) {
			if (err) {
				req.flash('error', 'Something went wrong');
				return res.redirect('/campgrounds');
			} else {
				Campground.countDocuments().exec(function(err, count) {
					if (err) {
						req.flash('error', 'Something went wrong');
						return res.redirect('/campgrounds');
					}
					res.render('campgrounds/index', {
						campgrounds: allCampgrounds,
						noMatch: noMatch,
						page: 'campgrounds',
						current: pageNumber,
						pages: Math.ceil(count / perPage),
						search: false
					});
				});
			}
		});
	}
});

//NEW - show form to create new campground
router.get('/new', middleware.isLoggedIn, function(req, res) {
	res.render('campgrounds/new');
});

//CREATE - add new campground to DB
router.post('/', middleware.isLoggedIn, imageUpload, function(req, res) {
	if (!req.body.name) {
		req.flash('error', 'Campground name should not be empty');
		return res.redirect('/campgrounds/new');
	}
	if (!req.body.price) {
		req.flash('error', 'Campground price should not be empty');
		return res.redirect('/campgrounds/new');
	}
	if (!req.body.location) {
		req.flash('error', 'Campground location should not be empty');
		return res.redirect('/campgrounds/new');
	}
	if (!req.body.description) {
		req.flash('error', 'Campground description should not be empty');
		return res.redirect('/campgrounds/new');
	}
	//geocode the location
	openGeocoder().geocode(req.body.location).end((err, result) => {
		if (err || result.length == 0) {
			req.flash('error', 'Invalid Location');
			return res.redirect('/campgrounds/new');
		} else {
			if (req.file) {
				//upload to cloudinary
				cloudinary.v2.uploader.upload(req.file.path, function(err, resultCloudinary) {
					if (err) {
						req.flash('error', 'Somethong went wrong');
						return res.redirect('/campgrounds/new');
					}
					var newCampground = {
						name: req.body.name,
						price: req.body.price,
						image: resultCloudinary.secure_url,
						imageId: resultCloudinary.public_id,
						description: req.body.description,
						author: {
							id: req.user._id,
							username: req.user.username
						},
						location: req.body.location,
						lat: result[0].lat,
						lon: result[0].lon
					};
					//add to database
					Campground.create(newCampground, function(err, newlyCreated) {
						if (err) {
							req.flash('error', 'Something went wrong');
							return res.redirect('/campgrounds/new');
						} else {
							User.findById(req.user._id).populate('followers').exec(async function(err, user) {
								if (err) {
									req.flash('error', 'Something went wrong');
									return res.redirect('/campgrounds/new');
								} else {
									let newNotification = {
										username: req.user.username,
										campgroundId: newlyCreated._id
									};
									for (const follower of user.followers) {
										let notification = await Notification.create(newNotification);
										follower.notifications.push(notification);
										follower.save();
									}
									req.flash('success', 'Campground created successfully');
									res.redirect('/campgrounds/' + newlyCreated._id);
								}
							});
						}
					});
				});
			} else {
				req.flash('error', 'You must choose an image');
				return res.redirect('/campgrounds/new');
			}
		}
	});
});

//SHOW - shows more info about one campground
router.get('/:id', function(req, res) {
	Campground.findById(req.params.id)
		.populate('comments')
		.populate('likes')
		.populate({
			path: 'reviews',
			options: { sort: { createdAt: -1 } }
		})
		.exec(function(err, foundCampground) {
			if (err) {
				req.flash('error', 'Campground not found');
				return res.redirect('/campgrounds');
			} else {
				res.render('campgrounds/show', { campground: foundCampground });
			}
		});
});

//Campground Like Route
router.post('/:id/like', middleware.isLoggedIn, function(req, res) {
	Campground.findById(req.params.id, function(err, foundCampground) {
		if (err) {
			req.flash('error', 'Something went wrong');
			return res.redirect('/campgrounds');
		}
		var foundUserLike = foundCampground.likes.some(function(like) {
			return like.equals(req.user._id);
		});
		if (foundUserLike) {
			//user already liked, removing like
			foundCampground.likes.pull(req.user._id);
		} else {
			//adding the new user like
			foundCampground.likes.push(req.user._id);
		}
		foundCampground.save(function(err) {
			if (err) {
				req.flash('error', 'Something went wrong');
				return res.redirect('/campgrounds');
			}
			return res.redirect('/campgrounds/' + foundCampground._id);
		});
	});
});

//EDIT CAMPGROUND ROUTE
router.get('/:id/edit', middleware.checkCampgroundOwnership, function(req, res) {
	Campground.findById(req.params.id, function(err, foundCampground) {
		if (err) {
			req.flash('error', 'Something went wrong');
			return res.redirect('/campgrounds');
		} else {
			res.render('campgrounds/edit', { campground: foundCampground });
		}
	});
});

//UPDATE CAMPGROUND ROUTE
router.put('/:id', middleware.checkCampgroundOwnership, imageUpload, function(req, res) {
	if (!req.body.campground.name) {
		req.flash('error', 'Campground name should not be empty');
		return res.redirect('/campgrounds/' + req.params.id + '/edit');
	}
	if (!req.body.campground.price) {
		req.flash('error', 'Campground price should not be empty');
		return res.redirect('/campgrounds/' + req.params.id + '/edit');
	}
	if (!req.body.campground.location) {
		req.flash('error', 'Campground location should not be empty');
		return res.redirect('/campgrounds/' + req.params.id + '/edit');
	}
	if (!req.body.campground.description) {
		req.flash('error', 'Campground description should not be empty');
		return res.redirect('/campgrounds/' + req.params.id + '/edit');
	}
	openGeocoder().geocode(req.body.campground.location).end((err, result) => {
		if (err || result.length == 0) {
			req.flash('error', 'Invalid Location');
			return res.redirect('/campgrounds/' + req.params.id + '/edit');
		} else {
			Campground.findById(req.params.id, async function(err, foundCampground) {
				if (err) {
					req.flash('error', 'Something went wrong');
					return res.redirect('/campgrounds');
				}
				foundCampground.name = req.body.campground.name;
				foundCampground.price = req.body.campground.price;
				foundCampground.description = req.body.campground.description;
				foundCampground.location = req.body.campground.location;
				foundCampground.lat = result[0].lat;
				foundCampground.lon = result[0].lon;
				if (req.file) {
					try {
						let previousImageId = foundCampground.imageId;
						var resultCloudinary = await cloudinary.v2.uploader.upload(req.file.path);
						foundCampground.image = resultCloudinary.secure_url;
						foundCampground.imageId = resultCloudinary.public_id;
						await cloudinary.v2.uploader.destroy(previousImageId);
					} catch (err) {
						req.flash('error', 'Something went wrong');
						return res.redirect('/campgrounds/' + req.params.id + '/edit');
					}
				}
				foundCampground.save();
				req.flash('success', 'Campground updated');
				res.redirect('/campgrounds/' + req.params.id);
			});
		}
	});
});

//DESTROY CAMPGROUND ROUTE
router.delete('/:id', middleware.checkCampgroundOwnership, function(req, res) {
	Campground.findById(req.params.id, async function(err, foundCampground) {
		if (err) {
			req.flash('error', 'Something went wrong');
			return res.redirect('/campgrounds');
		}
		try {
			await cloudinary.v2.uploader.destroy(foundCampground.imageId);
			foundCampground.remove();
			req.flash('success', 'Campground deleted successfully');
			res.redirect('/campgrounds');
		} catch (err) {
			req.flash('error', 'Something went wrong');
			return res.redirect('/campgrounds/' + req.params.id);
		}
	});
});

module.exports = router;
