var mongoose = require('mongoose');

var campgroundSchema = new mongoose.Schema({
	name: String,
	price: String,
	location: String,
	description: String,
	image: String,
	imageId: String,
	lat: Number,
	lon: Number,
	createdAt: { type: Date, default: Date.now },
	author: {
		id: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User'
		},
		username: String
	},
	likes: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User'
		}
	],
	comments: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Comment'
		}
	],
	reviews: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Review'
		}
	],
	rating: {
		type: Number,
		default: 0
	}
});

module.exports = mongoose.model('Campground', campgroundSchema);
