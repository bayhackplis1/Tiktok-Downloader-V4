import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { validateTikTokUrl } from "../client/src/lib/validators";
import { spawn } from "child_process";
import { promisify } from "util";
import { exec } from "child_process";
import { createReadStream } from "fs";
import path from "path";
import { mkdir } from "fs/promises";

const execPromise = promisify(exec);
const tiktokInfoSchema = z.object({
  url: validateTikTokUrl,
});

export function registerRoutes(app: Express): Server {
  app.post("/api/tiktok/info", async (req, res) => {
    try {
      const { url } = tiktokInfoSchema.parse(req.body);

      // Obtener información completa del video usando yt-dlp
      const { stdout } = await execPromise(`yt-dlp --dump-json "${url}"`);
      const videoInfo = JSON.parse(stdout);

      console.log('Video info extracted:', {
        title: videoInfo.title,
        creator: videoInfo.uploader || videoInfo.creator,
        views: videoInfo.view_count,
        likes: videoInfo.like_count
      });

      // Formatear duración
      const formatDuration = (seconds: number) => {
        if (!seconds) return "00:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
      };

      // Formatear número con separadores
      const formatNumber = (num: number | null | undefined) => {
        if (!num) return "0";
        return num.toLocaleString();
      };

      // Formatear tamaño de archivo
      const formatFileSize = (bytes: number | null | undefined) => {
        if (!bytes) return "N/A";
        const mb = bytes / 1024 / 1024;
        return `${mb.toFixed(2)} MB`;
      };

      // Extraer hashtags del título o descripción
      const extractHashtags = (text: string): string[] => {
        if (!text) return [];
        const hashtagRegex = /#[\w\u00C0-\u017F]+/g;
        const matches = text.match(hashtagRegex);
        return matches ? matches.map(tag => tag.slice(1)) : [];
      };

      // Formatear fecha - maneja tanto YYYYMMDD de upload_date como timestamp Unix
      const formatDate = (uploadDate: string | null, timestamp: number | null) => {
        let date: Date | null = null;
        
        // Intentar parsear upload_date en formato YYYYMMDD
        if (uploadDate && /^\d{8}$/.test(uploadDate)) {
          const year = uploadDate.substring(0, 4);
          const month = uploadDate.substring(4, 6);
          const day = uploadDate.substring(6, 8);
          date = new Date(`${year}-${month}-${day}`);
        }
        
        // Si no funciona, intentar con timestamp Unix (en segundos)
        if (!date && timestamp) {
          date = new Date(timestamp * 1000); // Convertir segundos a milisegundos
        }
        
        // Si aún no hay fecha válida, retornar Unknown
        if (!date || isNaN(date.getTime())) {
          return "Unknown";
        }
        
        return date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      };

      const responseData = {
        videoUrl: "/api/tiktok/download/video?url=" + encodeURIComponent(url),
        audioUrl: "/api/tiktok/download/audio?url=" + encodeURIComponent(url),
        thumbnail: videoInfo.thumbnail || "https://picsum.photos/seed/tiktok/1280/720",
        title: videoInfo.title || videoInfo.description || "TikTok Video",
        description: videoInfo.description || videoInfo.title || "No description available",
        
        // Metadatos técnicos del video
        metadata: {
          duration: formatDuration(videoInfo.duration),
          videoSize: formatFileSize(videoInfo.filesize || videoInfo.filesize_approx),
          audioSize: formatFileSize(videoInfo.audio_filesize || videoInfo.filesize_approx * 0.1),
          resolution: `${videoInfo.width || 1080}x${videoInfo.height || 1920}`,
          format: videoInfo.ext?.toUpperCase() || "MP4",
          codec: videoInfo.vcodec || "H.264",
          fps: videoInfo.fps || 30,
          bitrate: videoInfo.tbr ? `${Math.round(videoInfo.tbr)} kbps` : "N/A",
          width: videoInfo.width || 1080,
          height: videoInfo.height || 1920,
          audioCodec: videoInfo.acodec || "AAC",
          audioChannels: videoInfo.audio_channels || 2,
          audioSampleRate: videoInfo.asr ? `${(videoInfo.asr / 1000).toFixed(1)} kHz` : "44.1 kHz",
        },

        // Información del creador
        creator: {
          username: videoInfo.uploader_id || videoInfo.uploader || "Unknown",
          nickname: videoInfo.uploader || videoInfo.creator || "TikTok User",
          avatar: videoInfo.uploader_url || videoInfo.channel_url,
          verified: videoInfo.uploader_verified || false,
        },

        // Estadísticas del video
        stats: {
          views: videoInfo.view_count || 0,
          likes: videoInfo.like_count || 0,
          comments: videoInfo.comment_count || 0,
          shares: videoInfo.repost_count || 0,
          favorites: videoInfo.bookmark_count || 0,
        },

        // Información del audio
        audio: {
          title: videoInfo.track || videoInfo.alt_title || "Original Sound",
          author: videoInfo.artist || videoInfo.uploader || "Unknown Artist",
        },

        // Hashtags
        hashtags: extractHashtags(videoInfo.description || videoInfo.title || ""),

        // Fecha de subida
        uploadDate: formatDate(videoInfo.upload_date, videoInfo.timestamp),

        // ID del video
        videoId: videoInfo.id || videoInfo.display_id || "unknown",
      };

      res.json(responseData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        console.error('Error getting video info:', error);
        res.status(500).json({ message: "Failed to process TikTok URL" });
      }
    }
  });

  app.get("/api/tiktok/download/:type", async (req, res) => {
    try {
      const { type } = req.params;
      const url = req.query.url as string;

      if (!url) {
        return res.status(400).json({ message: "URL is required" });
      }

      const tempPath = path.join(process.cwd(), "temp");
      await mkdir(tempPath, { recursive: true });

      const timestamp = Date.now();
      const outputFile = path.join(tempPath, `tiktok-${type}-${timestamp}.${type === 'video' ? 'mp4' : 'mp3'}`);

      const options = type === 'video' 
        ? ['--format', 'best[ext=mp4]', '--force-overwrites']
        : ['--extract-audio', '--audio-format', 'mp3', '--force-overwrites'];

      const ytdlp = spawn('yt-dlp', [
        ...options,
        '-o', outputFile,
        url
      ]);

      await new Promise((resolve, reject) => {
        ytdlp.on('close', (code) => {
          if (code === 0) resolve(code);
          else reject(new Error(`yt-dlp exited with code ${code}`));
        });

        ytdlp.stderr.on('data', (data) => {
          console.error(`yt-dlp error: ${data}`);
        });
      });

      const extension = type === 'video' ? 'mp4' : 'mp3';
      res.setHeader('Content-Type', type === 'video' ? 'video/mp4' : 'audio/mpeg');
      res.setHeader('Content-Disposition', `attachment; filename="tiktok-${type}-${timestamp}.${extension}"`);

      const fileStream = createReadStream(outputFile);
      fileStream.pipe(res);

    } catch (error) {
      console.error('Download error:', error);
      res.status(500).json({ message: "Failed to download content" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
