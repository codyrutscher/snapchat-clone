import OpenAI from 'openai';
import { OPENAI_API_KEY } from './config';

class ContentModerationService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
      dangerouslyAllowBrowser: true
    });
    
    // Forbidden patterns for quick filtering
    this.forbiddenPatterns = [
      /\b(hate|kill|die|murder)\b/gi,
      /\b(drugs|cocaine|heroin|meth)\b/gi,
      // Add more patterns as needed
    ];
  }

  // Check text content for inappropriate material
  async moderateText(text) {
    try {
      // Quick pattern check
      for (const pattern of this.forbiddenPatterns) {
        if (pattern.test(text)) {
          return {
            flagged: true,
            reason: 'Contains forbidden content',
            severity: 'high'
          };
        }
      }

      // Use OpenAI moderation API
      if (this.openai) {
        const response = await this.openai.moderations.create({
          input: text,
        });

        const results = response.results[0];
        if (results.flagged) {
          const categories = Object.entries(results.categories)
            .filter(([_, flagged]) => flagged)
            .map(([category]) => category);
          
          return {
            flagged: true,
            reason: `Flagged for: ${categories.join(', ')}`,
            severity: this.getSeverity(results.category_scores),
            categories
          };
        }
      }

      return { flagged: false };
    } catch (error) {
      console.error('Moderation error:', error);
      // Default to safe in case of error
      return { flagged: false };
    }
  }

  // Check image content using AI
  async moderateImage(imageUrl) {
    try {
      if (!this.openai) return { flagged: false };

      // Use GPT-4 Vision to analyze image
      const response = await this.openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              { 
                type: "text", 
                text: "Is this image appropriate for a social media app? Check for violence, adult content, hate symbols, or other inappropriate content. Respond with JSON: {appropriate: boolean, reason: string}" 
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl,
                  detail: "low"
                }
              }
            ],
          },
        ],
        max_tokens: 100,
      });

      const result = JSON.parse(response.choices[0].message.content);
      return {
        flagged: !result.appropriate,
        reason: result.reason
      };
    } catch (error) {
      console.error('Image moderation error:', error);
      return { flagged: false };
    }
  }

  getSeverity(scores) {
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore > 0.8) return 'high';
    if (maxScore > 0.5) return 'medium';
    return 'low';
  }

  // Filter out flagged content from a list
  async filterContent(items, contentKey = 'text') {
    const moderationPromises = items.map(async (item) => {
      const result = await this.moderateText(item[contentKey] || '');
      return { ...item, moderation: result };
    });

    const moderatedItems = await Promise.all(moderationPromises);
    return moderatedItems.filter(item => !item.moderation.flagged);
  }
}

export default new ContentModerationService();