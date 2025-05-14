const express = require('express')
const router = express.Router()
const MenfessController  = require('../controllers/spotify-controller')
const CommentController = require('../controllers/comment-controller')
const verifyCaptcha = require('../middleware/verifyCaptcha');
const honeypotMiddleware = require('../middleware/honeypotMiddleware');

// Routes Menfess
// router.get('/menfess', Controller.getMenfess)
// router.post('/menfess', Controller.createMenfess)
// router.put('/menfess/:id', MenfessController.editMenfess)
// router.get('/menfess/:id', Controller.getMenfessById)
// router.delete('/menfess/:id', MenfessController.deleteMenfess)

// Route Menfess v2
router.post('/menfess-spotify',honeypotMiddleware, verifyCaptcha, MenfessController.createMenfessWithSpotify);
router.get('/menfess-spotify-search', MenfessController.getMenfessSpotify);
router.get('/menfess-spotify-search/:id', MenfessController.getMenfessSpotifyById);
router.get('/search-spotify-song', MenfessController.searchSpotifySong);


router.post('/comments',verifyCaptcha, CommentController.createComment);
router.get('/comments/:id_menfess', CommentController.getComment);


module.exports = router