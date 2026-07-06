export interface User {
  id: string | number;
  name?: string;
  profile_image?: string;
  is_online?: boolean;
  store_name?: string;
  last_login?: string;
}

export interface Thread {
  thread_id?: string | number;
  id?: string | number;
  other_user_id?: string | number;
  other_user_name?: string;
  other_user_image?: string;
  other_user_online?: boolean;
  last_message?: string;
  last_message_at?: string;
  last_sender_id?: string | number;
  unread_count?: number | string;
  product_title?: string;
  product_image?: string;
}

export interface Message {
  id: string | number;
  client_message_id?: string;
  thread_id?: string | number;
  sender_id?: string | number;
  message?: string;
  message_type?: string;
  media_url?: string;
  created_at?: string;
  status?: string;
  reply_to_id?: string | number;
  location?: { lat: number; lng: number; address?: string };
  shared_product?: SharedProduct;
  _offerMeta?: OfferMeta;
  _temp?: boolean;
  _failed?: boolean;
  _timedOut?: boolean;
  _deleted?: boolean;
}

export interface OfferMeta {
  amount: number;
  status?: string;
}

export interface SharedProduct {
  id: string | number;
  slug?: string;
  title: string;
  price: number | string;
  image?: string;
}

export interface Product {
  id?: string | number;
  slug?: string;
  title: string;
  price?: number | string;
  images?: string[];
}