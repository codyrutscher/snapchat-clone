import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import OpenAIService from '../services/OpenAIService';
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
      const suggestions = await OpenAIService.generateCaptions(imageContext);
      setCaptions(suggestions);
    } catch (error) {
      console.error('Error loading captions:', error);
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
    try {
      const data = await OpenAIService.analyzeFriendshipInsights();
      setInsights(data);
    } catch (error) {
      console.error('Error loading insights:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Analyzing your friendships...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.insightsContainer}>
      {insights?.insights.map((insight, index) => (
        <View key={index} style={styles.insightCard}>
          <Ionicons name="bulb-outline" size={20} color={Colors.primary} />
          <Text style={styles.insightText}>{insight}</Text>
        </View>
      ))}
      
      <Text style={styles.sectionTitle}>Recommendations</Text>
      {insights?.recommendations.map((rec, index) => (
        <View key={index} style={styles.recommendationCard}>
          <Text style={styles.recommendationText}>{rec}</Text>
        </View>
      ))}
    </ScrollView>
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
          {index === 0 && <View style={styles.aiRecommendedBadge}>
            <Text style={styles.aiBadgeText}>AI Pick</Text>
          </View>}
        </TouchableOpacity>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 10,
    backgroundColor: Colors.white,
    borderRadius: 10,
    marginVertical: 5,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.black,
    marginBottom: 10,
  },
  loadingText: {
    fontSize: 12,
    color: Colors.gray,
    marginLeft: 10,
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
  },
  refreshButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 5,
  },
  ideaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginVertical: 10,
  },
  ideaButtonText: {
    color: Colors.white,
    marginLeft: 10,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
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
    color: Colors.black,
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
  backgroundColor: 'rgba(255,255,255,0.95)',
  padding: 15,
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
},
replyTitle: {
  fontSize: 12,
  color: Colors.gray,
  marginBottom: 10,
},
replyChip: {
  backgroundColor: Colors.primary,
  paddingHorizontal: 20,
  paddingVertical: 10,
  borderRadius: 20,
  marginRight: 10,
},
replyText: {
  color: 'white',
  fontWeight: 'bold',
},
insightsContainer: {
  flex: 1,
},
insightCard: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: Colors.primary + '10',
  padding: 15,
  borderRadius: 10,
  marginBottom: 10,
},
insightText: {
  flex: 1,
  marginLeft: 10,
  fontSize: 14,
  color: Colors.black,
},
sectionTitle: {
  fontSize: 16,
  fontWeight: 'bold',
  marginTop: 20,
  marginBottom: 10,
},
recommendationCard: {
  backgroundColor: Colors.success + '10',
  padding: 15,
  borderRadius: 10,
  marginBottom: 10,
},
recommendationText: {
  fontSize: 14,
  color: Colors.black,
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
  backgroundColor: '#f0f0f0',
  marginBottom: 5,
},
filterName: {
  fontSize: 14,
  fontWeight: 'bold',
},
filterReason: {
  fontSize: 10,
  color: Colors.gray,
  textAlign: 'center',
  marginTop: 2,
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
  color: 'white',
  fontSize: 10,
  fontWeight: 'bold',
},
  ideaText: {
    fontSize: 16,
    color: Colors.black,
    flex: 1,
  },
  refreshIdeasButton: {
    backgroundColor: Colors.primary,
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
  },
  refreshText: {
    color: Colors.white,
    fontWeight: 'bold',
  },
  timeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: Colors.white,
    borderRadius: 20,
    marginVertical: 5,
  },
  timeText: {
    marginLeft: 5,
    fontSize: 14,
    color: Colors.gray,
  },
  goodTimeText: {
    color: Colors.success,
    fontWeight: 'bold',
  },
});