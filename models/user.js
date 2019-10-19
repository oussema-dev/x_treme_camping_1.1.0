var mongoose = require('mongoose');
var uniqueValidator = require('mongoose-unique-validator');
var passportLocalMongoose = require('passport-local-mongoose');

var UserSchema = new mongoose.Schema({
	username: String,
	password: String,
	firstName: String,
	lastName: String,
	email: {
		type: String,
		unique: true,
		required: true,
		uniqueCaseInsensitive: true
	},
	profilePicture: String,
	isVerified: { type: Boolean, default: false },
	verificationToken: String,
	resetPasswordToken: String,
	resetPasswordExpires: Date,
	notifications: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Notification'
		}
	],
	followers: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User'
		}
	],
	following: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User'
		}
	]
});

UserSchema.plugin(uniqueValidator, { message: 'A user is already registered with the given email address' });
UserSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model('User', UserSchema);
