'use client';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type {
  AlbumDto,
  AuditEntryDto,
  ClanDto,
  EventDto,
  FriendRequestDto,
  InvitationDto,
  MeResponse,
  MediaDto,
  MemberDto,
  NotificationPrefs,
  Page,
  PersonDto,
  StoryDto,
  TimelineEntry,
  TreeDto,
  TreeGraph,
  TreeRole,
  TreeWithAccess,
} from '@super-project/types';
import { useApi } from './api';
import { useAuthState } from './auth';

export const qk = {
  me: ['me'] as const,
  trees: ['trees'] as const,
  publicTrees: ['public-trees'] as const,
  tree: (id: string) => ['tree', id] as const,
  graph: (id: string) => ['tree', id, 'graph'] as const,
  person: (t: string, p: string) => ['tree', t, 'person', p] as const,
  members: (t: string) => ['tree', t, 'members'] as const,
  invitations: (t: string) => ['tree', t, 'invitations'] as const,
  friends: (t: string) => ['tree', t, 'friends'] as const,
  audit: (t: string, entityId?: string) => ['tree', t, 'audit', entityId ?? ''] as const,
  media: (t: string, f: object) => ['tree', t, 'media', f] as const,
  albums: (t: string) => ['tree', t, 'albums'] as const,
  stories: (t: string, personId?: string) => ['tree', t, 'stories', personId ?? ''] as const,
  events: (t: string, personId?: string) => ['tree', t, 'events', personId ?? ''] as const,
  timeline: (t: string) => ['tree', t, 'timeline'] as const,
  upcoming: ['upcoming'] as const,
  prefs: ['notification-prefs'] as const,
  clans: ['clans'] as const,
};

export type MyTree = TreeDto & { role: TreeRole; personId: string | null };
export interface UpcomingItem {
  kind: 'birthday' | 'death_anniversary' | 'wedding_anniversary';
  refId: string;
  personIds: string[];
  names: string[];
  treeId: string;
  treeName: string;
  daysUntil: number;
  years: number | null;
  isJubilee: boolean;
  deceased: boolean;
  on: { year: number; month: number; day: number };
}

export function useMe() {
  const api = useApi();
  const { isSignedIn } = useAuthState();
  return useQuery({ queryKey: qk.me, queryFn: () => api.get<MeResponse>('/me'), enabled: isSignedIn });
}

export function useMyTrees() {
  const api = useApi();
  const { isSignedIn } = useAuthState();
  return useQuery({ queryKey: qk.trees, queryFn: () => api.get<MyTree[]>('/trees'), enabled: isSignedIn });
}

export function usePublicTrees() {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: qk.publicTrees,
    queryFn: ({ pageParam }) => api.get<Page<TreeDto>>('/public-trees', { cursor: pageParam, limit: 24 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useTree(treeId: string) {
  const api = useApi();
  const { isLoaded } = useAuthState();
  return useQuery({ queryKey: qk.tree(treeId), queryFn: () => api.get<TreeWithAccess>(`/trees/${treeId}`), enabled: isLoaded, retry: false });
}

export function useGraph(treeId: string, enabled = true) {
  const api = useApi();
  const { isLoaded } = useAuthState();
  return useQuery({ queryKey: qk.graph(treeId), queryFn: () => api.get<TreeGraph>(`/trees/${treeId}/graph`), enabled: isLoaded && enabled, retry: false });
}

export function usePerson(treeId: string, personId: string | null) {
  const api = useApi();
  const { isLoaded } = useAuthState();
  return useQuery({
    queryKey: qk.person(treeId, personId ?? ''),
    queryFn: () => api.get<PersonDto>(`/trees/${treeId}/persons/${personId}`),
    enabled: isLoaded && !!personId,
  });
}

export function useMembers(treeId: string, enabled = true) {
  const api = useApi();
  return useQuery({ queryKey: qk.members(treeId), queryFn: () => api.get<MemberDto[]>(`/trees/${treeId}/members`), enabled });
}

export function useInvitations(treeId: string, enabled = true) {
  const api = useApi();
  return useQuery({ queryKey: qk.invitations(treeId), queryFn: () => api.get<InvitationDto[]>(`/trees/${treeId}/invitations`), enabled });
}

export function useFriendRequests(treeId: string, enabled = true) {
  const api = useApi();
  return useQuery({ queryKey: qk.friends(treeId), queryFn: () => api.get<FriendRequestDto[]>(`/trees/${treeId}/friend-requests`), enabled });
}

export function useAudit(treeId: string, entityId?: string, enabled = true) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: qk.audit(treeId, entityId),
    queryFn: ({ pageParam }) => api.get<Page<AuditEntryDto>>(`/trees/${treeId}/audit`, { cursor: pageParam, limit: 25, entityId }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  });
}

export interface MediaFilter {
  kind?: string;
  albumId?: string;
  personId?: string;
  category?: string;
}

export function useMediaList(treeId: string, filter: MediaFilter, enabled = true) {
  const api = useApi();
  const { isLoaded } = useAuthState();
  return useInfiniteQuery({
    queryKey: qk.media(treeId, filter),
    queryFn: ({ pageParam }) => api.get<Page<MediaDto>>(`/trees/${treeId}/media`, { cursor: pageParam, limit: 30, ...filter }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: isLoaded && enabled,
  });
}

export function useAlbums(treeId: string) {
  const api = useApi();
  const { isLoaded } = useAuthState();
  return useQuery({ queryKey: qk.albums(treeId), queryFn: () => api.get<AlbumDto[]>(`/trees/${treeId}/albums`), enabled: isLoaded });
}

export function useStories(treeId: string, personId?: string) {
  const api = useApi();
  const { isLoaded } = useAuthState();
  return useQuery({ queryKey: qk.stories(treeId, personId), queryFn: () => api.get<StoryDto[]>(`/trees/${treeId}/stories`, { personId }), enabled: isLoaded });
}

export function useEvents(treeId: string, personId?: string) {
  const api = useApi();
  const { isLoaded } = useAuthState();
  return useQuery({ queryKey: qk.events(treeId, personId), queryFn: () => api.get<EventDto[]>(`/trees/${treeId}/events`, { personId }), enabled: isLoaded });
}

export function useTimeline(treeId: string) {
  const api = useApi();
  const { isLoaded } = useAuthState();
  return useQuery({ queryKey: qk.timeline(treeId), queryFn: () => api.get<TimelineEntry[]>(`/trees/${treeId}/timeline`), enabled: isLoaded });
}

export function useUpcoming(days = 30) {
  const api = useApi();
  const { isSignedIn } = useAuthState();
  return useQuery({ queryKey: [...qk.upcoming, days], queryFn: () => api.get<UpcomingItem[]>('/me/upcoming', { days }), enabled: isSignedIn });
}

export function useNotificationPrefs() {
  const api = useApi();
  const { isSignedIn } = useAuthState();
  return useQuery({
    queryKey: qk.prefs,
    queryFn: () => api.get<NotificationPrefs & { pushSubscriptions: number; emailAddress: string | null }>('/me/notification-prefs'),
    enabled: isSignedIn,
  });
}

export function useClans() {
  const api = useApi();
  return useQuery({ queryKey: qk.clans, queryFn: () => api.get<ClanDto[]>('/clans'), staleTime: 60 * 60 * 1000 });
}

/** Mutation that invalidates the given query keys on success. */
export function useInvalidatingMutation<TVars, TData = unknown>(fn: (vars: TVars) => Promise<TData>, keys: QueryKey[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: k }))),
  });
}
