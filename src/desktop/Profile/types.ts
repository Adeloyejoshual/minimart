/* ═══════════════════════════════════════════════════════════════
   DESKTOP PROFILE — TYPE DEFINITIONS
═══════════════════════════════════════════════════════════════ */

export interface UserLocation {
  state?: string;
  city?: string;
}

export interface User {
  id: string | number;
  name: string;
  email?: string;
  phone?: string;
  phone_number?: string;
  store_name?: string;
  profile_image?: string;
  referral_code?: string;
  rating?: number | null;
  total_views?: number;
  total_sales?: number;
  verified?: boolean;
  is_seller?: boolean;
  is_top_seller?: boolean;
  created_at?: string;
  joined_at?: string;
  location?: UserLocation;
  location_state?: string;
  location_city?: string;
  state?: string;
  city?: string;
}

export interface ListingImage {
  url?: string;
}

export interface Listing {
  id: string | number;
  title: string;
  price: number | string;
  image?: string;
  main_image?: string;
  thumbnail_url?: string;
  images?: Array<string | ListingImage>;
  status?: string;
  is_promoted?: boolean;
  views?: number;
  created_at?: string;
  slug?: string;
}

export interface SubscriptionStatus {
  isActive: boolean;
  plan?: string;
  planName?: string;
  planBadge?: string;
  expiresAt?: string;
  features?: string[];
}

export interface SubBadgeInfo {
  label: string;
  className: string;
  gradient: string;
  glow: string;
}

export interface MenuBadge {
  text: string;
  type?: "notif" | "sub" | "win" | "new" | "money";
}

export interface MenuItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  desc?: string;
  badge?: MenuBadge | null;
}

export interface MenuSection {
  title: string;
  sectionIcon: React.ReactNode;
  color: string;
  items: MenuItem[];
}

export interface DesktopProfileProps {
  onLogout?: () => void;
}

export interface SidebarProps {
  user: User | undefined;
  joinedLabel: string | null;
  subStatus: SubscriptionStatus | null;
  menuSections: MenuSection[];
  currentPath: string;
  onEditProfile: () => void;
  onLogout: () => void;
}

export interface DesktopHeroProps {
  user: User | undefined;
  joinedLabel: string | null;
  subStatus: SubscriptionStatus | null;
  listingsCount: number;
  onEdit: () => void;
}

export interface ListingsGridProps {
  listings: Listing[];
  onViewAll: () => void;
}

export interface StatsBarProps {
  user: User | undefined;
  listingsCount: number;
}

export interface QuickActionsProps {
  onPost: () => void;
  onDashboard: () => void;
  onMessages: () => void;
  onNotifications: () => void;
  unreadCount: number;
}
