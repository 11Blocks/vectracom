import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Badge, EmptyState, ListRow, Screen, SkeletonCard } from '../components/ui';
import { spacing } from '../theme/colors';
import { ChatRoom, listChatRooms } from '../services/chat';

export function MessagesScreen() {
  const nav = useNavigation<any>();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listChatRooms();
      setRooms(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setRooms([]);
      setError(e?.message || 'Impossible de charger les salons');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <Screen
      title="Messages"
      subtitle={`${rooms.length} salon(s)`}
      refreshing={loading}
      onRefresh={load}
    >
      {loading && rooms.length === 0 ? (
        <View style={{ gap: spacing.sm, marginTop: 8 }}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : error ? (
        <EmptyState title="Messages indisponibles" description={error} />
      ) : rooms.length === 0 ? (
        <EmptyState title="Aucun salon" description="Remontée et équipes apparaîtront ici." />
      ) : (
        rooms.map((r) => (
          <ListRow
            key={r.id}
            title={r.title}
            subtitle={r.lastMessagePreview || 'Aucun message'}
            trailing={
              <Badge tone={r.kind === 'remontee' ? 'warning' : r.kind === 'mission' ? 'ai' : 'info'}>
                {r.kind}
              </Badge>
            }
            onPress={() => nav.navigate('Conversation', { roomId: r.id, title: r.title })}
          />
        ))
      )}
    </Screen>
  );
}
