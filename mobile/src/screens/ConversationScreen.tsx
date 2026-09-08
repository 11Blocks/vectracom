import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Button, Input, Screen, useToast } from '../components/ui';
import { colors, spacing } from '../theme/colors';
import { uploadFile, getApiUrl } from '../services/api';
import { ChatMessage, listChatMessages, postChatMessage } from '../services/chat';

function resolveMediaUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  const base = getApiUrl().replace(/\/api\/v1\/?$/, '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function ConversationScreen() {
  const route = useRoute<any>();
  const { toast } = useToast();
  const roomId = route.params?.roomId as string;
  const title = route.params?.title as string | undefined;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await listChatMessages(roomId);
      setMessages(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setError(e?.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  const send = async (body?: string, photoUrl?: string) => {
    const textBody = (body ?? text).trim();
    if (!textBody && !photoUrl) return;
    setSending(true);
    try {
      const msg = await postChatMessage(roomId, textBody || (photoUrl ? '📷 Photo' : ''), photoUrl);
      setMessages((prev) => [...prev, msg]);
      setText('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (e: any) {
      setError(e?.message || 'Envoi impossible');
      toast({ title: 'Message', description: e?.message || 'Envoi impossible', variant: 'error' });
    } finally {
      setSending(false);
    }
  };

  const attachPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      toast({ title: 'Caméra', description: 'Permission refusée', variant: 'warning' });
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (res.canceled || !res.assets[0]?.uri) return;
    setSending(true);
    try {
      const url = await uploadFile(res.assets[0].uri, 'missions');
      await send(text.trim() || '📷 Photo', url);
    } catch (e: any) {
      toast({ title: 'Photo', description: e?.message || 'Upload échoué', variant: 'error' });
      setSending(false);
    }
  };

  return (
    <Screen title={title || 'Conversation'} scroll={false} style={{ flex: 1, paddingBottom: 0 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        {loading && messages.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <Text style={styles.empty}>{error || 'Écrivez le premier message.'}</Text>
            }
            renderItem={({ item }) => (
              <View
                style={[
                  styles.bubble,
                  item.mine ? styles.mine : styles.theirs,
                  item.source === 'whatsapp' && styles.wa,
                  item.source === 'system' && styles.system,
                ]}
              >
                {!item.mine ? (
                  <Text style={styles.sender}>
                    {item.source === 'whatsapp'
                      ? `WhatsApp · ${item.senderName}`
                      : item.source === 'system'
                        ? item.senderName
                        : item.senderName}
                  </Text>
                ) : null}
                {item.photoUrl ? (
                  <Image
                    source={{ uri: resolveMediaUrl(item.photoUrl) }}
                    style={styles.photo}
                    resizeMode="cover"
                  />
                ) : null}
                {item.body ? (
                  <Text style={[styles.body, item.mine && styles.bodyMine]}>{item.body}</Text>
                ) : null}
                <Text style={styles.time}>
                  {new Date(item.createdAt).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            )}
          />
        )}
        <View style={styles.composer}>
          <Pressable
            onPress={attachPhoto}
            disabled={sending}
            style={({ pressed }) => [styles.attach, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.attachText}>Photo</Text>
          </Pressable>
          <Input
            value={text}
            onChangeText={setText}
            placeholder="Message…"
            style={{ flex: 1 }}
          />
          <Button loading={sending} onPress={() => send()} style={{ alignSelf: 'stretch', minWidth: 88 }}>
            Envoyer
          </Button>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: spacing.sm, gap: spacing.sm, flexGrow: 1 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40 },
  bubble: {
    maxWidth: '82%',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  mine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primarySoft25,
    borderColor: colors.primarySoft40,
    borderWidth: 1,
  },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.cardAlt,
    borderColor: colors.border,
    borderWidth: 1,
  },
  wa: {
    borderColor: colors.waBorder45,
    backgroundColor: colors.waSoft12,
  },
  system: {
    alignSelf: 'center',
    maxWidth: '92%',
    backgroundColor: colors.whiteSoft06,
    borderColor: colors.border,
  },
  sender: { fontSize: 10, color: colors.muted, fontWeight: '600' },
  body: { fontSize: 14, color: colors.text },
  bodyMine: { color: colors.text },
  photo: {
    width: 200,
    height: 160,
    borderRadius: 8,
    marginVertical: 4,
    backgroundColor: colors.card,
  },
  time: { fontSize: 10, color: colors.muted, alignSelf: 'flex-end' },
  composer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  attach: {
    height: 44,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachText: { fontSize: 12, fontWeight: '600', color: colors.primary },
});
