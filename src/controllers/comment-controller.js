const supabase = require('../database');
const { response } = require('../services/response');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 60 * 5 });

class CommentController {
    static async createComment(req, res) {
        try {
            const { id_menfess, content } = req.body;
    
            if (!id_menfess || !content) {
                const responseData = response(false, false, 'id_menfess dan content harus diisi');
                return res.status(400).json(responseData);
            }
    
            const cachedMenfess = cache.get(`menfess_${id_menfess}`);
            let menfessExists;
    
            if (cachedMenfess) {
                menfessExists = cachedMenfess;
            } else {
                const { data: menfess, error } = await supabase
                    .from('menfess')
                    .select('id')
                    .eq('id', id_menfess)
                    .single();
    
                if (error || !menfess) {
                    const responseData = response(false, false, 'Menfess tidak ditemukan');
                    return res.status(404).json(responseData);
                }
    
                menfessExists = menfess;
                cache.set(`menfess_${id_menfess}`, menfessExists);
            }
    
            const { data: newComment, error: commentError } = await supabase
                .from('comment')
                .insert({
                    id_menfess,
                    content,
                    created_at: new Date().toISOString(),
                })
                .select()
                .single();
    
            if (commentError) {
                const responseData = response(false, false, 'Gagal menambahkan komentar', commentError);
                return res.status(500).json(responseData);
            }
    
            const responseData = response(true, true, 'Komentar berhasil ditambahkan', newComment);
            return res.status(201).json(responseData);
    
        } catch (error) {
            console.error(error);
            const responseData = response(false, false, 'Terjadi kesalahan pada server', error);
            return res.status(500).json(responseData);
        }
    }
    static async getComment(req, res) {
        try {
            const { id_menfess } = req.params;
            
            console.log('[DEBUG] Received id_menfess:', id_menfess);
    
            if (!id_menfess) {
                const responseData = response(400, false, 'ID Menfess harus diisi');
                return res.status(400).json(responseData);
            }
    
            const menfessId = Number(id_menfess);
            if (isNaN(menfessId)) {
                const responseData = response(400, false, 'ID Menfess harus berupa angka');
                return res.status(400).json(responseData);
            }
    
            console.log('[DEBUG] Querying comments for id_menfess:', menfessId);
    
            const { data: comments, error } = await supabase
                .from('comment')
                .select('*')
                .eq('id_menfess', menfessId)
                .order('created_at', { ascending: false })
                .limit(100);
    
            console.log('[DEBUG] Query Result:', { comments, error });
    
            if (error) {
                console.error('[ERROR] Supabase query failed:', error);
                const responseData = response(500, false, 'Gagal mengambil komentar', error);
                return res.status(500).json(responseData);
            }
    
            if (!comments || comments.length === 0) {
                console.warn('[DEBUG] No comments found for id_menfess:', menfessId);
                const responseData = response(404, false, 'Tidak ada komentar');
                return res.status(404).json(responseData);
            }
    
            console.log('[DEBUG] Comments fetched successfully:', comments);
            const responseData = response(200, true, 'Komentar berhasil diambil', comments);
            return res.status(200).json(responseData);
    
        } catch (error) {
            console.error('[ERROR] Unexpected server error:', error);
            const responseData = response(500, false, 'Terjadi kesalahan pada server', error.message);
            return res.status(500).json(responseData);
        }
    }
    
}

module.exports = CommentController;
