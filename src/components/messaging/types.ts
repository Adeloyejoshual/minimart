export interface User {
  id: string | number;
  name?: string;
  profile_image?: string | null;
  is_online?: boolean;
  store_name?: string;
  last_login?: string | null;
}

export interface Thread {
  thread_id?: string | number;
  id?: string | number;
  buyer_id?: string | number;
  seller_id?: string | number;
  other_user_id?: string | number;
  other_user_name?: string;
  other_user_image?: string | null;
  other_user_online?: boolean;
  last_message?: string;
  last_message_at?: string;
  last_sender_id?: string | number;
  unread_count?: number | string;
  product_id?: string | number;
  product_slug?: string;
  product_title?: string;
  product_image?: string | null;
  product_price?: number | string;
}

export interface Message {
  id: string | number;
  client_message_id?: string;
  thread_id?: string | number;
  sender_id?: string | number;
  message?: string;
  message_type?: string;
  media_url?: string | null;
  created_at?: string;
  status?: string;
  reply_to_id?: string | number;
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
  shared_product?: {
    id: string | number;
    slug?: string;
    title: string;
    price: number | string;
    image?: string;
  };
  _offerMeta?: {
    amount: number;
    status?: string;
  };
  _temp?: boolean;
  _failed?: boolean;
  _timedOut?: boolean;
  _deleted?: boolean;
}

export interface Product {
  id?: string | number;
  slug?: string;
  title: string;
  price?: number | string;
  images?: string[];
}