var express = require('express');
var router = express.Router();
var User = require('../models/user');
var Campground = require('../models/campground');
var middleware = require('../middleware');

//show user profile
router.get('/users/:id', middleware.isLoggedIn, async function(req, res) {
	try {
		let foundUser = await User.findById(req.params.id).populate('followers').populate('following').exec();
		let foundCampgrounds = await Campground.find().where('author.id').equals(foundUser._id).exec();
		let found_User = await User.findById(req.params.id);
		let showFollowBtn = false;
		let showUnfollowBtn = false;
		if (!found_User.followers.includes(req.user._id) && !found_User._id.equals(req.user._id)) {
			showFollowBtn = true;
		}
		if (found_User.followers.includes(req.user._id) && !found_User._id.equals(req.user._id)) {
			showUnfollowBtn = true;
		}
		res.render('users/show', {
			user: foundUser,
			campgrounds: foundCampgrounds,
			followers: foundUser.followers,
			followings: foundUser.following,
			showFollowBtn: showFollowBtn,
			showUnfollowBtn: showUnfollowBtn,
			page: 'show'
		});
	} catch (err) {
		req.flash('error', 'Something went wrong');
		return res.redirect('/campgrounds');
	}
});

//modify profile picture
router.put('/users/:id', middleware.isLoggedIn, async function(req, res) {
	try {
		let user = await User.findById(req.params.id);
		if (user._id.equals(req.user._id)) {
			if (req.body.profilePicture === '') {
				user.profilePicture = 'https://cnam.ca/wp-content/uploads/2018/06/default-profile.gif';
			} else {
				user.profilePicture = req.body.profilePicture;
			}
			await user.save();
			return res.redirect('/users/' + req.params.id);
		} else {
			req.flash('error', "You don't have permission to do that");
			res.redirect('/users/' + req.params.id);
		}
	} catch (err) {
		req.flash('error', 'Something went wrong');
		res.redirect('/campgrounds');
	}
});

//follow user
router.get('/follow/:id', middleware.isLoggedIn, async function(req, res) {
	try {
		let user = await User.findById(req.params.id);
		if (user._id.equals(req.user._id)) {
			req.flash('error', "You can't follow yourself");
			return res.redirect('/users/' + req.params.id);
		}
		if (user.followers.includes(req.user._id)) {
			req.flash('error', 'You already follow ' + user.username + '!');
			return res.redirect('/users/' + req.params.id);
		} else {
			let me = await User.findById(req.user._id);
			me.following.push(req.params.id);
			await me.save();
			user.followers.push(req.user._id);
			await user.save();
			res.redirect('/users/' + req.params.id);
		}
	} catch (err) {
		req.flash('error', 'Something went wrong');
		res.redirect('/campgrounds');
	}
});

//unfollow user
router.get('/unfollow/:id', middleware.isLoggedIn, async function(req, res) {
	try {
		let user = await User.findById(req.params.id);
		if (user._id.equals(req.user._id)) {
			req.flash('error', "You can't unfollow yourself");
			return res.redirect('/users/' + req.params.id);
		}
		if (user.followers.includes(req.user._id)) {
			let followerIndex = user.followers.indexOf(req.user._id);
			user.followers.splice(followerIndex, 1);
			await user.save();
			let me = await User.findById(req.user._id);
			let followingIndex = me.following.indexOf(req.params.id);
			if (followingIndex > -1) {
				me.following.splice(followingIndex, 1);
				await me.save();
				return res.redirect('/users/' + req.params.id);
			} else {
				req.flash('error', 'Something went wrong');
				return res.redirect('/users/' + req.params.id);
			}
		} else {
			req.flash('error', 'You must follow ' + user.username + ' first!');
			return res.redirect('/users/' + req.params.id);
		}
	} catch (err) {
		req.flash('error', 'Something went wrong');
		res.redirect('/campgrounds');
	}
});

module.exports = router;
