var express = require('express');
var router = express.Router();
var User = require('../models/user');
var Notification = require('../models/notification');
var middleware = require('../middleware');

//view all notifications
router.get('/', middleware.isLoggedIn, async function(req, res) {
	try {
		let user = await User.findById(req.user._id)
			.populate({
				path: 'notifications',
				options: { sort: { _id: -1 } }
			})
			.exec();
		let allNotifications = user.notifications;
		res.render('notifications/index', { allNotifications, page: 'notifications' });
	} catch (err) {
		req.flash('error', 'Something went wrong');
		res.redirect('/campgrounds');
	}
});

router.get('/:id', middleware.isLoggedIn, async function(req, res) {
	try {
		let notification = await Notification.findById(req.params.id);
		notification.isRead = true;
		notification.save();
		res.redirect(`/campgrounds/${notification.campgroundId}`);
	} catch (err) {
		req.flash('error', 'Something went wrong');
		res.redirect('/notifications');
	}
});

router.delete('/:id', middleware.isLoggedIn, async function(req, res) {
	try {
		let me = await User.findById(req.user._id);
		let notificationIndex = me.notifications.indexOf(req.params.id);
		if (notificationIndex > -1) {
			me.notifications.splice(notificationIndex, 1);
			me.save();
			Notification.deleteOne({ _id: req.params.id }, function(err) {
				if (err) {
					req.flash('error', 'Something went wrong');
					return res.redirect('/notifications');
				} else {
					return res.redirect('/notifications');
				}
			});
		}
	} catch (err) {
		req.flash('error', 'Something went wrong');
		res.redirect('/notifications');
	}
});

module.exports = router;
