import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import OpenAIService from '../services/OpenAIServiceSimple';
import { Colors } from '../constants/Colors';

export function CaptionSuggestions({ imageContext, onSelect }) {
  const [captions, setCaptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCaptions();
  }, [imageContext]);

  const loadCaptions = async () => {
    setLoading(true);
    try {
      console.log('Loading AI captions...');
      const suggestions = await OpenAIService.generateCaptions(imageContext);
      console.log('Received captions:', suggestions);
      setCaptions(suggestions || []);
    } catch (error) {
      console.error('Error loading captions:', error);
      // Use fallback captions
      setCaptions([
        "Great moment! 📸",
        "Living life ✨",
        "Mood 💯",
        "Vibes only",
        "Love this!"
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={styles.loadingText}>AI is thinking...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI Caption Suggestions</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {captions.map((caption, index) => (
          <TouchableOpacity
            key={index}
            style={styles.captionChip}
            onPress={() => onSelect(caption)}
          >
            <Text style={styles.captionText}>{caption}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <TouchableOpacity style={styles.refreshButton} onPress={loadCaptions}>
        <Ionicons name="refresh" size={16} color={Colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

export function FriendRecommendations({ onSelectUser }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecommendations();
  }, []);

  const loadRecommendations = async () => {
    try {
      const recs = await OpenAIService.generateFriendRecommendations();
      setRecommendations(recs);
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={styles.loadingText}>Finding perfect matches...</Text>
      </View>
    );
  }

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <View style={styles.recommendationsContainer}>
      <Text style={styles.recommendationsTitle}>Suggested Friends</Text>
      {recommendations.map((rec, index) => (
        <TouchableOpacity
          key={index}
          style={styles.recommendationCard}
          onPress={() => onSelectUser(rec)}
        >
          <View style={styles.recommendationInfo}>
            <Text style={styles.recommendationName}>{rec.username}</Text>
            <Text style={styles.recommendationReason}>{rec.reason}</Text>
            {rec.commonInterests.length > 0 && (
              <View style={styles.interestsRow}>
                {rec.commonInterests.map((interest, i) => (
                  <View key={i} style={styles.interestBadge}>
                    <Text style={styles.interestText}>{interest}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          <Ionicons name="person-add" size={24} color={Colors.primary} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function StoryIdeasWidget({ onSelectIdea }) {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const loadIdeas = async () => {
    setLoading(true);
    try {
      const suggestions = await OpenAIService.generateStoryIdeas();
      setIdeas(suggestions);
    } catch (error) {
      console.error('Error loading ideas:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <TouchableOpacity style={styles.ideaButton} onPress={() => {
        setShowModal(true);
        if (ideas.length === 0) loadIdeas();
      }}>
        <Ionicons name="bulb-outline" size={24} color={Colors.primary} />
        <Text style={styles.ideaButtonText}>Get Story Ideas</Text>
      </TouchableOpacity>

      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>AI Story Ideas</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={Colors.black} />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>Generating ideas...</Text>
              </View>
            ) : (
              <ScrollView style={styles.ideasList}>
                {ideas.map((idea, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.ideaItem}
                    onPress={() => {
                      onSelectIdea(idea);
                      setShowModal(false);
                    }}
                  >
                    <Text style={styles.ideaText}>{idea}</Text>
                    <Ionicons name="arrow-forward" size={20} color={Colors.gray} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.refreshIdeasButton} onPress={loadIdeas}>
              <Text style={styles.refreshText}>Get New Ideas</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

export function BestTimeIndicator() {
  const [bestTimes, setBestTimes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBestTimes();
  }, []);

  const loadBestTimes = async () => {
    try {
      const times = await OpenAIService.analyzeBestPostingTime();
      setBestTimes(times);
    } catch (error) {
      console.error('Error loading best times:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentHour = new Date().getHours();
  const isGoodTime = bestTimes.some(time => {
    const [start] = time.time.split(' - ')[0].split(':');
    return Math.abs(parseInt(start) - currentHour) <= 1;
  });

  return (
    <View style={styles.timeIndicator}>
      <Ionicons 
        name="time-outline" 
        size={20} 
        color={isGoodTime ? Colors.success : Colors.gray} 
      />
      <Text style={[styles.timeText, isGoodTime && styles.goodTimeText]}>
        {isGoodTime ? 'Great time to post!' : 'Check best posting times'}
      </Text>
    </View>
  );
}

export function SmartReplyBar({ snapContext, onSelectReply }) {
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReplies();
  }, [snapContext]);

  const loadReplies = async () => {
    try {
      const suggestions = await OpenAIService.generateSmartReplies(snapContext);
      setReplies(suggestions);
    } catch (error) {
      console.error('Error loading replies:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.replyBar}>
      <Text style={styles.replyTitle}>Quick Replies</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          replies.map((reply, index) => (
            <TouchableOpacity
              key={index}
              style={styles.replyChip}
              onPress={() => onSelectReply(reply)}
            >
              <Text style={styles.replyText}>{reply}</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

export function FriendshipInsights() {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    console.log('Loading developer friendship insights...');
    try {
      const data = await OpenAIService.analyzeFriendshipInsights();
      console.log('Developer insights received:', data);
      setInsights(data);
    } catch (error) {
      console.error('Error loading insights:', error);
      setInsights({
        insights: ['Error loading insights'],
        recommendations: ['Please try again later']
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ padding: 20, alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ marginTop: 10, fontSize: 16, color: Colors.text }}>
          Analyzing your developer network...
        </Text>
      </View>
    );
  }

  if (!insights || !insights.insights) {
    return (
      <View style={{ padding: 20, alignItems: 'center' }}>
        <Text style={{ fontSize: 16, color: Colors.text }}>
          No insights available
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
        <View style={{ marginBottom: 25 }}>
          <Text style={{ 
            fontSize: 20,
            fontWeight: 'bold', 
            marginBottom: 20,
            color: Colors.primary,
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'
          }}>
            Developer Insights
          </Text>
          {insights.insights.map((insight, index) => (
            <View 
              key={index} 
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                backgroundColor: Colors.primary + '10',
                padding: 18,
                borderRadius: 12,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: Colors.primary + '30',
              }}
            >
              <Ionicons name="code-slash" size={24} color={Colors.primary} />
              <Text style={{ 
                flex: 1, 
                marginLeft: 12,
                fontSize: 16,
                color: Colors.text,
                lineHeight: 22,
                fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'
              }}>
                {insight}
              </Text>
            </View>
          ))}
        </View>
        
        <View>
          <Text style={{ 
            fontSize: 20,
            fontWeight: 'bold', 
            marginBottom: 20,
            color: Colors.primary,
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'
          }}>
            Recommendations
          </Text>
          {insights.recommendations.map((rec, index) => (
            <View 
              key={index} 
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                backgroundColor: Colors.success + '10',
                padding: 18,
                borderRadius: 12,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: Colors.success + '30',
              }}
            >
              <Ionicons name="rocket" size={24} color={Colors.success} />
              <Text style={{ 
                flex: 1, 
                marginLeft: 12,
                fontSize: 16,
                color: Colors.text,
                lineHeight: 22,
                fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'
              }}>
                {rec}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export function SmartFilterRecommendations({ imageAnalysis, onSelectFilter, currentFilter }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecommendations();
  }, [imageAnalysis]);

  const loadRecommendations = async () => {
    try {
      const recs = await OpenAIService.recommendFilters(imageAnalysis);
      setRecommendations(recs);
    } catch (error) {
      console.error('Error loading filter recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {recommendations.map((rec, index) => (
        <TouchableOpacity
          key={index}
          style={[
            styles.filterOption,
            currentFilter === rec.filter && styles.selectedFilter
          ]}
          onPress={() => onSelectFilter(rec.filter)}
        >
          <View style={styles.filterPreview} />
          <Text style={styles.filterName}>{rec.filter}</Text>
          <Text style={styles.filterReason}>{rec.reason}</Text>
          {index === 0 && (
            <View style={styles.aiRecommendedBadge}>
              <Text style={styles.aiBadgeText}>AI Pick</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 10,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    marginVertical: 5,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  loadingText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  captionChip: {
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  captionText: {
    color: Colors.primary,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  refreshButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 5,
  },
  recommendationsContainer: {
    backgroundColor: Colors.surface,
    padding: 15,
    marginVertical: 10,
    marginHorizontal: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  recommendationsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  recommendationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  recommendationInfo: {
    flex: 1,
  },
  recommendationName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  recommendationReason: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  interestsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  interestBadge: {
    backgroundColor: Colors.primary + '20',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 5,
    marginTop: 3,
  },
  interestText: {
    fontSize: 12,
    color: Colors.primary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  ideaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginVertical: 10,
  },
  ideaButtonText: {
    color: Colors.background,
    marginLeft: 10,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 30,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  loadingContainer: {
    padding: 50,
    alignItems: 'center',
  },
  ideasList: {
    paddingHorizontal: 20,
  },
  ideaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  replyBar: {
    backgroundColor: 'rgba(15,15,30,0.95)',
    padding: 15,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  replyTitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  replyChip: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
  },
  replyText: {
    color: Colors.background,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  filterOption: {
    alignItems: 'center',
    marginRight: 15,
    padding: 10,
  },
  selectedFilter: {
    backgroundColor: Colors.primary + '20',
    borderRadius: 10,
  },
  filterPreview: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: Colors.lightGray,
    marginBottom: 5,
  },
  filterName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  filterReason: {
    fontSize: 10,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  aiRecommendedBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  aiBadgeText: {
    color: Colors.background,
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  ideaText: {
    fontSize: 16,
    color: Colors.text,
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  refreshIdeasButton: {
    backgroundColor: Colors.primary,
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  refreshText: {
    color: Colors.background,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  timeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    marginVertical: 5,
  },
  timeText: {
    marginLeft: 5,
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  goodTimeText: {
    color: Colors.success,
    fontWeight: 'bold',
  },
});