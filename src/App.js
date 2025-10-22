import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const SIGNALING_SERVER_URL = "http://localhost:5050";
const socket = io(SIGNALING_SERVER_URL, { autoConnect: true });

export default function EchoLink() {
  const [myId, setMyId] = useState("");
  const [users, setUsers] = useState([]);
  const [targetId, setTargetId] = useState("");
  const [status, setStatus] = useState("🟢 Online");
  const [calling, setCalling] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [incoming, setIncoming] = useState(null);
  const [incomingOffer, setIncomingOffer] = useState(null); // 👈 store offer
  const [callTimer, setCallTimer] = useState(0);
  const [muted, setMuted] = useState(false);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const timerRef = useRef(null);

  const ICE_SERVERS = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

  // Socket listeners
  useEffect(() => {
    socket.on("connect", () => setMyId(socket.id));
    socket.on("user-list", (list) => setUsers(list.filter((id) => id !== socket.id)));
    socket.on("user-joined", (id) => setUsers((s) => (s.includes(id) ? s : [...s, id])));
    socket.on("user-left", (id) => setUsers((s) => s.filter((u) => u !== id)));

    // Incoming call
    socket.on("call-made", async (data) => {
      console.log("📞 Incoming call from:", data.socket);
      setIncoming(data.socket);
      setIncomingOffer(data.offer);
    });

    socket.on("answer-made", async (data) => {
      if (!pcRef.current) return;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      setCalling(false);
      setInCall(true);
      startTimer();
      setStatus(`🎧 On call with ${data.socket}`);
    });

    socket.on("ice-candidate", async (data) => {
      if (pcRef.current && data.candidate)
        await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
    });

    socket.on("call-ended", () => {
      cleanupCall();
    });

    return () => socket.removeAllListeners();
  }, []);

  // WebRTC helpers
  function attachPeerEvents(pc, remoteSocketId) {
    pc.onicecandidate = (ev) => {
      if (ev.candidate) socket.emit("ice-candidate", { to: remoteSocketId, candidate: ev.candidate });
    };
    pc.ontrack = (ev) => {
      remoteAudioRef.current.srcObject = ev.streams[0];
      remoteAudioRef.current.play().catch(() => {});
    };
    pc.onconnectionstatechange = () => {
      if (["disconnected", "closed"].includes(pc.connectionState) && inCall) cleanupCall();
    };
  }

  async function prepareLocalMedia() {
    if (!localStreamRef.current) {
      try {
        localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (error) {
        console.error("Mic error:", error);
        setStatus("🔴 Mic Access Denied");
        throw error;
      }
    }
    localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }

  async function callUser(target) {
    if (!target || inCall || calling || target === myId) return;
    setCalling(true);
    setStatus("📞 Calling...");
    try {
      await prepareLocalMedia();
    } catch {
      setCalling(false);
      return;
    }
    pcRef.current = new RTCPeerConnection(ICE_SERVERS);
    attachPeerEvents(pcRef.current, target);
    localStreamRef.current.getTracks().forEach((t) => pcRef.current.addTrack(t, localStreamRef.current));
    const offer = await pcRef.current.createOffer();
    await pcRef.current.setLocalDescription(offer);
    socket.emit("call-user", { to: target, offer });
    sessionStorage.setItem("echo_remote", target);
  }

  async function handleAccept() {
    if (!incoming || !incomingOffer) return;
    await prepareLocalMedia();

    pcRef.current = new RTCPeerConnection(ICE_SERVERS);
    attachPeerEvents(pcRef.current, incoming);

    localStreamRef.current.getTracks().forEach((t) => pcRef.current.addTrack(t, localStreamRef.current));

    await pcRef.current.setRemoteDescription(new RTCSessionDescription(incomingOffer));
    const answer = await pcRef.current.createAnswer();
    await pcRef.current.setLocalDescription(answer);
    socket.emit("make-answer", { to: incoming, answer });

    setInCall(true);
    setIncoming(null);
    setIncomingOffer(null);
    startTimer();
    setStatus(`🎧 On call with ${incoming}`);
    sessionStorage.setItem("echo_remote", incoming);
  }

  function rejectCall() {
    if (incoming) socket.emit("end-call", { to: incoming });
    setIncoming(null);
    setIncomingOffer(null);
  }

  function endCall() {
    const other = sessionStorage.getItem("echo_remote");
    if (other) socket.emit("end-call", { to: other });
    cleanupCall();
  }

  function cleanupCall() {
    if (pcRef.current) pcRef.current.close();
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop());
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    pcRef.current = null;
    localStreamRef.current = null;
    setInCall(false);
    setCalling(false);
    setIncoming(null);
    setIncomingOffer(null);
    setStatus("🟢 Online");
    stopTimer();
    setCallTimer(0);
    sessionStorage.removeItem("echo_remote");
  }

  function startTimer() {
    timerRef.current = setInterval(() => setCallTimer((s) => s + 1), 1000);
  }
  function stopTimer() {
    clearInterval(timerRef.current);
  }

  const formatTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // UI
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white font-inter">
      <div className="bg-gray-800/70 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-md p-6 border border-gray-700/50 text-center space-y-6">
        <div>
          <h1 className="text-4xl font-extrabold mb-1 text-blue-400">
            Echo<span className="text-white">Link</span>
          </h1>
          <p className="text-gray-400 text-sm">Seamless WebRTC Audio Calling</p>
        </div>

        <div className="bg-gray-700/40 rounded-xl p-2">
          <p className="text-xs text-gray-400">Your ID</p>
          <p className="text-sm font-mono">{myId || "Connecting..."}</p>
        </div>

        {incoming && !inCall && (
          <div className="bg-blue-900/40 border border-blue-600/30 rounded-xl p-4 animate-pulse">
            <p className="font-semibold mb-2">📞 Incoming call from</p>
            <p className="text-sm font-mono text-blue-300">{incoming}</p>
            <div className="flex gap-3 mt-3 justify-center">
              <button
                onClick={handleAccept}
                className="bg-green-500 hover:bg-green-600 px-4 py-1 rounded-full text-sm font-semibold shadow"
              >
                Accept ✅
              </button>
              <button
                onClick={rejectCall}
                className="bg-red-500 hover:bg-red-600 px-4 py-1 rounded-full text-sm font-semibold shadow"
              >
                Reject ❌
              </button>
            </div>
          </div>
        )}

        <div
          className={`py-2 rounded-xl font-bold ${
            inCall
              ? "bg-blue-600 shadow-md shadow-blue-600/50"
              : calling
              ? "bg-yellow-600 shadow-md shadow-yellow-600/50"
              : "bg-gray-700"
          }`}
        >
          <p className="text-xs tracking-wider">{status}</p>
          {inCall && <p className="text-lg font-mono mt-1">{formatTime(callTimer)}</p>}
        </div>

        <div>
          <label className="block text-xs text-gray-300 mb-1">Call User by ID</label>
          <div className="flex gap-2">
            <input
              className="flex-1 p-2 rounded-lg bg-gray-700 border border-gray-600 text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Paste User ID..."
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              disabled={inCall || calling}
            />
            <button
              onClick={() => callUser(targetId)}
              className={`p-2 rounded-lg text-lg font-bold ${
                inCall || calling || !targetId
                  ? "bg-gray-600 cursor-not-allowed"
                  : "bg-green-500 hover:bg-green-600 active:scale-95 shadow-md"
              }`}
              disabled={inCall || calling || !targetId}
            >
              {calling ? "⏳" : "📞"}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-300 mb-1">Online Users ({users.length})</label>
          <div className="max-h-40 overflow-y-auto p-2 border border-gray-700 rounded-lg bg-gray-700/30 flex flex-col gap-1 text-left">
            {users.length === 0 ? (
              <p className="text-gray-500 text-xs italic text-center">No other users online.</p>
            ) : (
              users.map((u) => (
                <button
                  key={u}
                  onClick={() => callUser(u)}
                  className={`w-full text-xs font-mono rounded-lg px-2 py-1 transition ${
                    inCall || calling
                      ? "bg-gray-700 text-gray-400"
                      : "bg-gray-600 hover:bg-blue-500 hover:text-white"
                  }`}
                  disabled={inCall || calling}
                >
                  {u}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => setMuted((m) => !m)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold ${
              inCall
                ? muted
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-gray-700 hover:bg-gray-600"
                : "bg-gray-600/50 text-gray-400"
            }`}
            disabled={!inCall}
          >
            {muted ? "🔇 Unmute" : "🎙️ Mute"}
          </button>
          <button
            onClick={endCall}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold ${
              inCall || calling ? "bg-red-600 hover:bg-red-700" : "bg-gray-600 cursor-not-allowed"
            }`}
            disabled={!inCall && !calling}
          >
            {inCall ? "🛑 End" : "❌ Cancel"}
          </button>
        </div>
      </div>
      <audio ref={remoteAudioRef} autoPlay className="hidden" />
    </div>
  );
}
