import React, { useState, useEffect } from "react";
import { 
  Heart, MessageCircle, Send, Plus, X, 
  Tag, Clock, AlertCircle, Camera, Check 
} from "lucide-react";
import { subscribePosts, createPost, likePost, commentPost, subscribeMatches } from "../services/db";
import { subscribeAuthState } from "../services/auth";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage, isConfigValid } from "../lib/firebase";

const PRESET_IMAGES = [
  { url: "https://images.unsplash.com/photo-1540747737956-378724044453?w=800&auto=format&fit=crop", label: "Stadium Lights" },
  { url: "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&auto=format&fit=crop", label: "Match action" },
  { url: "https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?w=800&auto=format&fit=crop", label: "Cricket Bat" },
  { url: "https://images.unsplash.com/photo-1624526261952-ab4114ae3f9f?w=800&auto=format&fit=crop", label: "Cricket Ball" }
];

export default function HighlightsPage({ checkedInPlayer, onOpenCheckIn }) {
  const [posts, setPosts] = useState([]);
  const [matches, setMatches] = useState([]);
  const [adminUser, setAdminUser] = useState(null);
  
  // Feed upload form states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [caption, setCaption] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [selectedPresetUrl, setSelectedPresetUrl] = useState(PRESET_IMAGES[0].url);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [uploadedType, setUploadedType] = useState("image");

  useEffect(() => {
    const unsubPosts = subscribePosts((list) => {
      setPosts(list);
    });
    const unsubMatches = subscribeMatches((list) => {
      setMatches(list);
    });
    const unsubAuth = subscribeAuthState((user) => {
      setAdminUser(user);
    });

    return () => {
      unsubPosts();
      unsubMatches();
      unsubAuth();
    };
  }, []);

  const openModal = () => {
    setCaption("");
    setSelectedMatchId("");
    setUploadedUrl("");
    setUploadedType("image");
    setUploadError("");
    setUploadProgress(0);
    setUploading(false);
    setSelectedPresetUrl(PRESET_IMAGES[0].url);
    setShowUploadModal(true);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadError("");
    setUploadedUrl("");

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) {
      setUploadError("Only image and video files are supported.");
      return;
    }

    const limit = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > limit) {
      setUploadError(`File size exceeds limit (${isVideo ? "50MB" : "10MB"}).`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    if (isConfigValid && storage) {
      try {
        const storageRef = ref(storage, `highlights/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(Math.round(progress));
          },
          (error) => {
            setUploadError("Upload failed: " + error.message);
            setUploading(false);
          },
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            setUploadedUrl(downloadURL);
            setUploadedType(isVideo ? "video" : "image");
            setUploading(false);
            setUploadProgress(100);
            setSelectedPresetUrl(""); // clear preset if custom uploaded successfully
          }
        );
      } catch (err) {
        setUploadError("Upload failed: " + err.message);
        setUploading(false);
      }
    } else {
      // Mock upload progress
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        setUploadProgress(progress);
        if (progress >= 100) {
          clearInterval(interval);
          const localUrl = URL.createObjectURL(file);
          if (file.size < 2 * 1024 * 1024) {
            const reader = new FileReader();
            reader.onload = (event) => {
              setUploadedUrl(event.target.result);
              setUploadedType(isVideo ? "video" : "image");
              setUploading(false);
              setSelectedPresetUrl("");
            };
            reader.readAsDataURL(file);
          } else {
            setUploadedUrl(localUrl);
            setUploadedType(isVideo ? "video" : "image");
            setUploading(false);
            setSelectedPresetUrl("");
          }
        }
      }, 100);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    setUploadError("");

    if (!caption.trim()) {
      setUploadError("Please write a caption.");
      return;
    }

    const finalMediaUrl = uploadedUrl || selectedPresetUrl;
    if (!finalMediaUrl) {
      setUploadError("Please upload a file or select a preset.");
      return;
    }

    const postPayload = {
      mediaUrl: finalMediaUrl,
      mediaType: uploadedUrl ? uploadedType : "image",
      caption: caption.trim(),
      matchId: selectedMatchId || ""
    };

    try {
      await createPost(postPayload);
      setCaption("");
      setSelectedMatchId("");
      setUploadedUrl("");
      setUploadedType("image");
      setShowUploadModal(false);
    } catch (err) {
      setUploadError("Failed to upload: " + err.message);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8 animate-pop">
      {/* Header and Upload button */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white tracking-tight">
            Club Highlights
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
            Instagram-style photo feed of highlights, match moments, and comments.
          </p>
        </div>

        <button
          onClick={openModal}
          className="p-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl shadow-lg transition-all active:scale-95 flex items-center space-x-1.5"
          title="Upload Highlight"
        >
          <Plus size={18} />
          <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Upload</span>
        </button>
      </div>

      {/* Feed list */}
      {posts.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl">
          <p className="text-slate-500 dark:text-slate-400 text-sm">No highlights uploaded yet.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {posts.map((post) => (
            <HighlightCard 
              key={post.id} 
              post={post} 
              matches={matches}
              checkedInPlayer={checkedInPlayer}
              onOpenCheckIn={onOpenCheckIn}
            />
          ))}
        </div>
      )}

      {/* -------------------------------------------------------------
          ADMIN UPLOAD HIGHLIGHT MODAL
          ------------------------------------------------------------- */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-pop p-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
              <h3 className="font-display font-extrabold text-lg text-slate-950 dark:text-white uppercase tracking-tight">
                Upload Match Highlight
              </h3>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            {uploadError && (
              <div className="flex items-center space-x-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 text-xs mb-4">
                <AlertCircle size={16} className="shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleCreatePost} className="space-y-4 text-xs font-semibold">
              {/* Preset image select */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Select Highlight Media</label>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {PRESET_IMAGES.map((img) => (
                    <button
                      key={img.url}
                      type="button"
                      onClick={() => { setSelectedPresetUrl(img.url); setUploadedUrl(""); }}
                      className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                        selectedPresetUrl === img.url && !uploadedUrl
                          ? "border-rose-600 ring-2 ring-rose-500/20"
                          : "border-transparent"
                      }`}
                    >
                      <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                      {selectedPresetUrl === img.url && !uploadedUrl && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
                          <Check size={16} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                <div className="relative mt-3">
                  {uploading ? (
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-xl p-3 flex flex-col space-y-2">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        <span>Uploading file...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-rose-600 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col space-y-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase">Or Upload Image / Video (Image: 10MB, Video: 50MB max)</label>
                      <input
                        type="file"
                        accept="image/*,video/*"
                        onChange={handleFileChange}
                        className="w-full text-xs text-slate-500 dark:text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100 dark:file:bg-rose-955/40 dark:file:text-rose-400"
                      />
                      {uploadedUrl && (
                        <p className="text-[10px] text-emerald-500 font-bold">
                          ✓ File uploaded: {uploadedType === "video" ? "Video" : "Image"}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Tag Match */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Tag Match (Optional)</label>
                <select
                  value={selectedMatchId}
                  onChange={(e) => setSelectedMatchId(e.target.value)}
                  className="w-full p-2.5 border rounded-xl dark:bg-slate-950 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-semibold cursor-pointer"
                >
                  <option value="">-- No Match Tag --</option>
                  {matches.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              {/* Caption */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Caption</label>
                <textarea
                  placeholder="What is happening in this highlight? #MonsoonTour"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full p-3 border rounded-xl dark:bg-slate-950 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none font-semibold"
                  rows={3}
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full mt-6 py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md uppercase tracking-wider"
              >
                Publish Post
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Interactive Single Post Component
function HighlightCard({ post, matches, checkedInPlayer, onOpenCheckIn }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  
  // Double tap heart pop-up animation states
  const [showHeartPop, setShowHeartPop] = useState(false);
  const [lastTap, setLastTap] = useState(0);

  const matchedMatch = matches.find(m => m.id === post.matchId);
  const likesCount = post.likes ? post.likes.length : 0;
  const isLiked = checkedInPlayer && post.likes && post.likes.includes(checkedInPlayer.phone);

  const handleLike = () => {
    if (!checkedInPlayer) {
      alert("Please check in first with your phone number to like posts.");
      onOpenCheckIn();
      return;
    }
    likePost(post.id, checkedInPlayer.phone);
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    if (now - lastTap < DOUBLE_PRESS_DELAY) {
      // It's a double tap!
      if (!isLiked) {
        handleLike();
      }
      setShowHeartPop(true);
      setTimeout(() => setShowHeartPop(false), 800);
    }
    setLastTap(now);
  };

  const handleSubmitComment = (e) => {
    e.preventDefault();
    if (!checkedInPlayer) {
      alert("Please check in with your phone number to submit comments.");
      onOpenCheckIn();
      return;
    }

    if (!commentText.trim()) return;

    commentPost(post.id, {
      phone: checkedInPlayer.phone,
      name: checkedInPlayer.name,
      text: commentText.trim()
    });

    setCommentText("");
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm animate-pop">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 font-display font-bold text-slate-700 dark:text-slate-300 text-sm flex items-center justify-center border border-slate-200 dark:border-slate-700">
            MT
          </div>
          <div>
            <span className="font-display font-bold text-xs text-slate-900 dark:text-white block">Club Scorer Admin</span>
            <span className="text-[10px] text-slate-400 font-medium flex items-center mt-0.5">
              <Clock size={10} className="mr-1" />
              <span>{new Date(post.uploadedAt).toLocaleDateString()}</span>
            </span>
          </div>
        </div>

        {matchedMatch && (
          <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-full text-[10px] font-bold">
            <Tag size={10} className="text-slate-400 mr-0.5" />
            <span className="truncate max-w-[120px]">{matchedMatch.name}</span>
          </div>
        )}
      </div>

      {/* Image Media Container with double-tap */}
      <div 
        onClick={handleDoubleTap}
        className="relative aspect-video sm:aspect-square bg-slate-950 flex items-center justify-center select-none cursor-pointer overflow-hidden group"
      >
        {post.mediaType === "video" ? (
          <video
            src={post.mediaUrl}
            controls
            playsInline
            className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-500"
          />
        ) : (
          <img 
            src={post.mediaUrl} 
            alt="Highlight moment" 
            className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-500" 
          />
        )}
        
        {/* Heart pop-up animation */}
        {showHeartPop && (
          <div className="absolute inset-0 bg-black/10 flex items-center justify-center animate-pop z-10">
            <Heart size={80} fill="white" className="text-white drop-shadow-xl scale-75 animate-bounce" />
          </div>
        )}
      </div>

      {/* Card Action footer bar */}
      <div className="p-4 space-y-3">
        <div className="flex items-center space-x-4">
          <button 
            onClick={handleLike} 
            className={`transition-transform duration-200 active:scale-75 ${isLiked ? 'text-red-500' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}
          >
            <Heart size={22} fill={isLiked ? "currentColor" : "none"} />
          </button>
          
          <button 
            onClick={() => setCommentsOpen(!commentsOpen)} 
            className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
          >
            <MessageCircle size={22} />
          </button>
        </div>

        {/* Likes Count */}
        <p className="text-xs font-bold text-slate-800 dark:text-white">
          {likesCount} {likesCount === 1 ? "like" : "likes"}
        </p>

        {/* Caption */}
        <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 font-medium">
          <span className="font-display font-black text-slate-900 dark:text-white mr-2">Admin Scorer</span>
          {post.caption}
        </p>

        {/* Comments view */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <button 
            onClick={() => setCommentsOpen(!commentsOpen)} 
            className="text-[10px] font-bold text-slate-400 dark:text-slate-500 hover:underline uppercase tracking-wide"
          >
            {commentsOpen ? "Collapse comments" : `View all ${post.comments ? post.comments.length : 0} comments`}
          </button>

          {commentsOpen && (
            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1 animate-pop">
              {post.comments && post.comments.map((comm, idx) => (
                <div key={idx} className="text-xs bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 font-medium">
                  <div className="flex items-center justify-between text-[9px] text-slate-400 mb-1">
                    <span className="font-extrabold text-slate-700 dark:text-slate-300">{comm.name}</span>
                    <span>{new Date(comm.timestamp).toLocaleDateString()}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 leading-normal">{comm.text}</p>
                </div>
              ))}
              {(!post.comments || post.comments.length === 0) && (
                <p className="text-slate-400 text-xs italic py-2">No comments yet. Be the first to comment!</p>
              )}
            </div>
          )}
        </div>

        {/* Add comment Form */}
        <form onSubmit={handleSubmitComment} className="flex items-center space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <input
            type="text"
            placeholder={checkedInPlayer ? `Add a comment as ${checkedInPlayer.name.split(" ")[0]}...` : "Check in with your phone to comment..."}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onClick={() => { if (!checkedInPlayer) onOpenCheckIn(); }}
            className="flex-1 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all"
          />
          <button 
            type="submit" 
            className="p-2 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white rounded-xl transition-all shadow-md shadow-teal-600/10 flex items-center justify-center shrink-0"
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}
