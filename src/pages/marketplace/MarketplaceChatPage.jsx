import React, { useEffect, useState } from "react";
import {
  Chat,
  Channel,
  ChannelHeader,
  MessageList,
  MessageInput,
  Thread,
} from "stream-chat-react";
import { StreamChat } from "stream-chat";
import { ApiService } from "../../services/ApiService.js";
import "stream-chat-react/dist/css/index.css";

const client = StreamChat.getInstance(import.meta.env.VITE_STREAM_API_KEY);

const MarketplaceChatPage = () => {
  const [channel, setChannel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initChat = async () => {
      try {
        // Replace with logged-in user's info
        const userId = localStorage.getItem("userId") || "user_1";
        const username = localStorage.getItem("username") || "Joshua";

        // Get chat token from backend
        const { token } = await ApiService.post("/api/chat/token", { userId, username });

        await client.connectUser(
          {
            id: userId,
            name: username,
          },
          token
        );

        // Create or get channel
        const chatChannel = client.channel("messaging", "marketplace_channel", {
          name: "Marketplace Chat",
          members: [userId],
        });

        await chatChannel.watch();
        setChannel(chatChannel);
      } catch (err) {
        console.error("Failed to initialize chat", err);
      } finally {
        setLoading(false);
      }
    };

    initChat();

    return () => {
      client.disconnectUser();
    };
  }, []);

  if (loading) return <p>Loading chat...</p>;
  if (!channel) return <p>Unable to load chat</p>;

  return (
    <div style={{ height: "80vh", maxWidth: "800px", margin: "auto" }}>
      <Chat client={client} theme="messaging light">
        <Channel channel={channel}>
          <ChannelHeader />
          <MessageList />
          <MessageInput />
          <Thread />
        </Channel>
      </Chat>
    </div>
  );
};

export default MarketplaceChatPage;