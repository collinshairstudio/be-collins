const SpotifyService = require('../services/spotify-service');
const supabase = require('../database');
const { response } = require('../services/response');
const NodeCache = require('node-cache');

const menfessCache = new NodeCache({ 
    stdTTL: 100,
    checkperiod: 320
});

class MenfessController {

    static async searchSpotifySong(req, res) {
        try {
          const { song } = req.query;
          if (!song || song.trim() === '') {
            return res.status(400).json({
              success: false,
              message: 'Song query is required',
            });
          }
          const tracks = await SpotifyService.searchSong(song);
          if (!tracks || tracks.length === 0) {
            return res.status(404).json({
              success: false,
              message: 'No songs found',
            });
          }
    
          return res.status(200).json({
            success: true,
            data: tracks,
          });
        } catch (error) {
          console.error('Error searching song:', error.message);
      
          return res.status(500).json({
            success: false,
            message: 'Failed to search song. Please try again later.',
          });
        }
      }

      static async createMenfessWithSpotify(req, res) {
        const honeypotFields = [
            'hidden_email', 
            'bot_trap', 
            'contact_secret',
            '_honeypot_field'
        ];
    
        const honeypotTriggered = honeypotFields.some(field => 
            req.body[field] !== undefined && 
            req.body[field] !== null && 
            req.body[field] !== ''
        );
    
        if (honeypotTriggered) {
            console.warn('Potential bot attempt detected', {
                ip: req.ip,
                timestamp: new Date(),
                triggeredFields: honeypotFields.filter(field => req.body[field])
            });
    
            return res.status(403).json({
                success: false,
                message: 'Bot activity detected'
            });
        }
    
        try {
            const { 
                sender, 
                message, 
                spotify_id, 
                recipient, 
                track_metadata,
                hidden_email,
                bot_trap,
                contact_secret,
                _honeypot_field,
            } = req.body;
    
            if (!sender || !message || !recipient || !spotify_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Sender, message, recipient, dan Spotify ID wajib diisi',
                });
            }
    
            // Function to determine card type based on date/time conditions
            const determineCardType = () => {
                const currentDate = new Date();
                
                // New Year condition (cardType: 1)
                const startNewYear = new Date('2024-12-31T21:00:00+07:00');
                const endNewYear = new Date('2025-01-01T02:00:00+07:00');
                if (currentDate >= startNewYear && currentDate <= endNewYear) {
                    return 1;
                }
    
                // Example: Valentine's Day condition (cardType: 2)
                // const isValentine = currentDate.getMonth() === 1 && currentDate.getDate() === 14;
                // if (isValentine) {
                //     return 2;
                // }
    
                // Add more special date conditions here as needed
                // Example template:
                // const startSpecialDay = new Date('YYYY-MM-DDThh:mm:ss+07:00');
                // const endSpecialDay = new Date('YYYY-MM-DDThh:mm:ss+07:00');
                // if (currentDate >= startSpecialDay && currentDate <= endSpecialDay) {
                //     return desiredCardType;
                // }
    
                // Default card type
                return 0;
            };
    
            let spotifyTrackData = await supabase
                .from('spotify')
                .select('*')
                .eq('spotify_id', spotify_id)
                .single();
    
            if (spotifyTrackData.error || !spotifyTrackData.data) {
                const trackDetails = track_metadata || await SpotifyService.getTrackDetails(spotify_id);
        
                if (!trackDetails) {
                    return res.status(404).json({
                        success: false,
                        message: 'Detail lagu tidak ditemukan',
                    });
                }
    
                const { data: newSpotifyTrack, error: spotifyInsertError } = await supabase
                    .from('spotify')
                    .insert({
                        spotify_id: trackDetails.id || spotify_id,
                        name: trackDetails.name,
                        artist: trackDetails.artist,
                        cover_url: trackDetails.cover_url,
                        external_url: trackDetails.external_url
                    })
                    .select()
                    .single();
        
                if (spotifyInsertError) {
                    return res.status(500).json({
                        success: false,
                        message: 'Gagal menyimpan metadata Spotify',
                    });
                }
    
                spotifyTrackData = { data: newSpotifyTrack };
            }
    
            const cardType = determineCardType();
    
            const { data: newMenfess, error: menfessError } = await supabase
                .from('menfess')
                .insert({
                    sender,
                    message,
                    spotify_id: spotify_id,
                    recipient,
                    cardType // Will be 0, 1, or 2 based on conditions
                })
                .select()
                .single();
        
            if (menfessError) {
                return res.status(500).json({
                    success: false,
                    message: 'Gagal membuat menfess',
                });
            }
        
            return res.status(201).json({
                success: true,
                message: 'Berhasil membuat menfess',
                data: {
                    menfess: newMenfess,
                    spotify: spotifyTrackData.data
                },
            });
        
        } catch (error) {
            console.error('Error membuat menfess:', error.message);
            return res.status(500).json({
                success: false,
                message: 'Kesalahan Internal Server',
                error: error.message
            });
        }
    }
  
    static async getMenfessSpotify(req, res) {
        try {
            const { 
                id, 
                sender, 
                recipient, 
                date, 
                sort,
                comment_sort,
                page = 1,
                per_page = 12
            } = req.query;
            
            const cacheKey = JSON.stringify({
                id, 
                sender: sender?.toLowerCase(), 
                recipient: recipient?.toLowerCase(), 
                date, 
                sort,
                comment_sort,
                page,
                per_page
            });
    
            const cachedData = menfessCache.get(cacheKey);
            if (cachedData) {
                return res.status(200).json(cachedData);
            }
    
            let query;
            let countQuery;
    
            if (id) {
                query = supabase
                    .from('menfess')
                    .select(`
                        *,
                        spotify_id,
                        comment_count:comment(count)
                    `)
                    .eq('id', id)
                    .single();
            } else {
                query = supabase
                    .from('menfess')
                    .select(`
                        *,
                        spotify_id
                    `);
    
                countQuery = supabase
                    .from('menfess')
                    .select('*', { count: 'exact', head: true });
    
                if (sender) {
                    const senderFilter = `%${sender.toLowerCase()}%`;
                    query = query.ilike('sender', senderFilter);
                    countQuery = countQuery.ilike('sender', senderFilter);
                }
                if (recipient) {
                    const recipientFilter = `%${recipient.toLowerCase()}%`;
                    query = query.ilike('recipient', recipientFilter);
                    countQuery = countQuery.ilike('recipient', recipientFilter);
                }
                if (date) {
                    const formattedDate = `${date} 00:00:00`;
                    const dateRange = {
                        gte: formattedDate,
                        lte: `${date} 23:59:59`
                    };
                    query = query.gte('created_at', dateRange.gte).lte('created_at', dateRange.lte);
                    countQuery = countQuery.gte('created_at', dateRange.gte).lte('created_at', dateRange.lte);
                }
    
                const isAscending = sort === 'asc';
                query = query.order('created_at', { ascending: isAscending });
    
                const currentPage = parseInt(page);
                const itemsPerPage = parseInt(per_page);
                const start = (currentPage - 1) * itemsPerPage;
                
                query = query
                    .range(start, start + itemsPerPage - 1);
            }
    
            const [{ data: menfesses, error }, { count, error: countError }] = await Promise.all([
                query,
                countQuery || { count: null, error: null }
            ]);
    
            if (error || countError) {
                console.error(error || countError);
                return res.status(500).json(response(500, false, "Internal Server Error", null));
            }
    
            if (!menfesses || (Array.isArray(menfesses) && menfesses.length === 0)) {
                return res.status(404).json(response(404, false, "Menfess tidak ditemukan", null));
            }
    
            const processedMenfesses = await Promise.all((Array.isArray(menfesses) ? menfesses : [menfesses]).map(async (menfess) => {
                let spotifyMetadata = null;
                let commentCount = 0;
                
                const { count: menfessCommentCount, error: countError } = await supabase
                    .from('comment')
                    .select('*', { count: 'exact', head: true })
                    .eq('id_menfess', menfess.id);
                
                commentCount = menfessCommentCount || 0;
    
                if (menfess.spotify_id) {
                    const { data: spotifyData, error: spotifyError } = await supabase
                        .from('spotify')
                        .select('*')
                        .eq('spotify_id', menfess.spotify_id)
                        .single();
    
                    if (spotifyData) {
                        spotifyMetadata = spotifyData;
                    }
                }
    
                return {
                    ...menfess,
                    comment_count: commentCount,
                    track: spotifyMetadata ? {
                        title: spotifyMetadata.name,
                        artist: spotifyMetadata.artist,
                        cover_img: spotifyMetadata.cover_url,
                        external_link: spotifyMetadata.external_url,
                        spotify_embed_link: `https://open.spotify.com/embed/track/${menfess.spotify_id}`
                    } : null
                };
            }));
    
            let sortedMenfesses = processedMenfesses;
            if (comment_sort) {
                sortedMenfesses = processedMenfesses.sort((a, b) => {
                    const commentCountA = a.comment_count || 0;
                    const commentCountB = b.comment_count || 0;
                    return comment_sort === 'asc' 
                        ? commentCountA - commentCountB 
                        : commentCountB - commentCountA;
                });
            }
    
            const totalItems = count || sortedMenfesses.length;
            const totalPages = Math.ceil(totalItems / per_page);
            const currentPage = parseInt(page);
    
            const responseData = response(200, true, null, {
                data: sortedMenfesses,
                meta: {
                    current_page: currentPage,
                    last_page: totalPages,
                    per_page: parseInt(per_page),
                    total: totalItems
                }
            });
    
            menfessCache.set(cacheKey, responseData);
    
            return res.status(200).json(responseData);
        } catch (error) {
            console.error(error);
            return res.status(500).json(response(500, false, "Internal Server Error", null));
        }
    }


static async getMenfessSpotifyById(req, res) {
    try {
        const id = req.params.id || req.query.id;

        if (!id) {
            return res.status(400).json(response(false, false, "ID is required", null));
        }

        const cacheKey = `menfess_${id}`;
        const cachedData = menfessCache.get(cacheKey);

        if (cachedData) {
            return res.status(200).json(cachedData);
        }

        const { data: menfess, error: menfessError } = await supabase
            .from('menfess')
            .select(`*, spotify_id`)
            .eq('id', id)
            .single();

        if (menfessError) {
            console.error("Supabase error fetching menfess:", menfessError);
            return res.status(500).json(response(false, false, "Internal Server Error", null));
        }

        if (!menfess) {
            return res.status(404).json(response(false, false, "Menfess tidak ditemukan", null));
        }

        let spotifyMetadata = null;
        if (menfess.spotify_id) {
            const { data: spotifyData, error: spotifyError } = await supabase
                .from('spotify')
                .select('*')
                .eq('spotify_id', menfess.spotify_id)
                .single();

            if (spotifyError) {
                console.error("Supabase error fetching Spotify metadata:", spotifyError);
            } else if (spotifyData) {
                spotifyMetadata = spotifyData;
            }
        }

        const processedMenfess = {
            ...menfess,
            track: spotifyMetadata ? {
                title: spotifyMetadata.name,
                artist: spotifyMetadata.artist,
                cover_img: spotifyMetadata.cover_url,
                external_link: spotifyMetadata.external_url,
                spotify_embed_link: `https://open.spotify.com/embed/track/${menfess.spotify_id}`
            } : null
        };

        const responseData = response(true, true, null, [processedMenfess]);

        menfessCache.set(cacheKey, responseData);

        return res.status(200).json(responseData);
    } catch (error) {
        console.error("Unexpected error:", error);
        return res.status(500).json(response(false, false, "Internal Server Error", null));
    }
}


}

module.exports = MenfessController;