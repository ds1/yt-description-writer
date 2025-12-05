// YT-Description-Writer MCP Server
// Generates SEO-optimized YouTube video descriptions

const WebSocket = require('ws');

class YTDescriptionWriter {
  constructor() {
    this.name = 'YT-Description-Writer';
    this.version = '1.0.0';
    this.capabilities = ['youtube', 'description', 'seo', 'content'];
    this.port = process.env.PORT || 3000;

    // Description section templates
    this.sectionTemplates = {
      hook: [
        '{title} - {hook}',
        'In this video: {hook}',
        '{hook}',
        '{title}\n\n{hook}'
      ],
      overview: [
        'In this {contentStyle}, you\'ll learn {learnings}.',
        'This video covers everything you need to know about {topic}.',
        'Whether you\'re a beginner or experienced, this {contentStyle} will help you {benefit}.',
        'Join me as I explore {topic} and share {value}.'
      ],
      timestamps: 'TIMESTAMPS:\n{timestamps}',
      callToAction: [
        'If you found this helpful, please LIKE and SUBSCRIBE!',
        'Don\'t forget to hit the notification bell!',
        'Leave a comment below with your questions!',
        'Share this with someone who needs it!'
      ],
      links: 'LINKS:\n{links}',
      social: 'CONNECT WITH ME:\n{socials}',
      hashtags: '\n{hashtags}'
    };
  }

  start() {
    const wss = new WebSocket.Server({ port: this.port });

    wss.on('connection', (ws) => {
      console.log(`[${new Date().toISOString()}] Client connected`);

      ws.on('message', async (message) => {
        try {
          const request = JSON.parse(message.toString());
          console.log(`[${new Date().toISOString()}] Received:`, request.method);

          const response = await this.handleRequest(request);
          ws.send(JSON.stringify(response));
        } catch (error) {
          console.error('Error processing message:', error);
          ws.send(JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32700, message: 'Parse error' },
            id: null
          }));
        }
      });

      ws.on('close', () => {
        console.log(`[${new Date().toISOString()}] Client disconnected`);
      });
    });

    console.log(`🚀 ${this.name} MCP server running on port ${this.port}`);

    if (process.env.REPLIT_ENVIRONMENT === 'production') {
      console.log(`📡 Published WebSocket URL: wss://yt-description-writer-agt.replit.app`);
    } else {
      console.log(`📡 Dev WebSocket URL: ws://localhost:${this.port}`);
    }
  }

  async handleRequest(request) {
    const { method, params, id } = request;

    switch(method) {
      case 'ping':
        return this.handlePing(id);

      case 'tools/list':
        return this.handleToolsList(id);

      case 'tools/call':
        return await this.handleToolCall(params, id);

      default:
        return {
          jsonrpc: '2.0',
          error: { code: -32601, message: `Method not found: ${method}` },
          id
        };
    }
  }

  handlePing(id) {
    return {
      jsonrpc: '2.0',
      result: {
        status: 'ok',
        agent: this.name,
        version: this.version,
        timestamp: new Date().toISOString()
      },
      id
    };
  }

  handleToolsList(id) {
    return {
      jsonrpc: '2.0',
      result: {
        tools: [
          {
            name: 'writeDescription',
            description: 'Generate an SEO-optimized YouTube description',
            inputSchema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'The video title'
                },
                concept: {
                  type: 'string',
                  description: 'The video concept/topic'
                },
                keywords: {
                  type: 'object',
                  description: 'Keywords data from analyzer'
                },
                contentStyle: {
                  type: 'string',
                  enum: ['tutorial', 'review', 'vlog', 'entertainment', 'educational'],
                  description: 'Style of content'
                },
                targetAudience: {
                  type: 'string',
                  description: 'Target audience'
                },
                timestamps: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      time: { type: 'string' },
                      label: { type: 'string' }
                    }
                  },
                  description: 'Video timestamps'
                },
                links: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Related links to include'
                },
                socialLinks: {
                  type: 'object',
                  description: 'Social media links'
                },
                includeHashtags: {
                  type: 'boolean',
                  default: true
                }
              },
              required: ['title', 'concept']
            }
          }
        ]
      },
      id
    };
  }

  async handleToolCall(params, id) {
    const { name, arguments: args } = params;

    if (name !== 'writeDescription') {
      return {
        jsonrpc: '2.0',
        error: { code: -32602, message: `Unknown tool: ${name}` },
        id
      };
    }

    try {
      const result = await this.writeDescription(args);
      return {
        jsonrpc: '2.0',
        result: {
          content: result
        },
        id
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        error: { code: -32603, message: error.message },
        id
      };
    }
  }

  async writeDescription({
    title,
    concept,
    keywords,
    contentStyle = 'tutorial',
    targetAudience = 'general',
    timestamps = [],
    links = [],
    socialLinks = {},
    includeHashtags = true
  }) {
    if (!title || !concept) {
      throw new Error('Title and concept are required');
    }

    console.log(`Writing description for: "${title}"`);

    // Extract keywords for SEO
    const primaryKeywords = keywords?.recommended?.primary || [];
    const secondaryKeywords = keywords?.recommended?.secondary || [];
    const keywordList = [
      ...primaryKeywords.map(k => k.keyword),
      ...secondaryKeywords.map(k => k.keyword)
    ].slice(0, 10);

    // Build description sections
    const sections = [];

    // 1. Hook section (first 150 chars are crucial for SEO)
    const hook = this.generateHook(title, concept, contentStyle, keywordList);
    sections.push(hook);

    // 2. Overview/main content
    const overview = this.generateOverview(concept, contentStyle, targetAudience, keywordList);
    sections.push(overview);

    // 3. Key points/what you'll learn
    const keyPoints = this.generateKeyPoints(concept, contentStyle);
    sections.push(keyPoints);

    // 4. Timestamps (if provided)
    if (timestamps.length > 0) {
      const timestampSection = this.formatTimestamps(timestamps);
      sections.push(timestampSection);
    } else {
      // Generate placeholder timestamps
      const placeholderTimestamps = this.generatePlaceholderTimestamps(contentStyle);
      sections.push(placeholderTimestamps);
    }

    // 5. Call to action
    const cta = this.generateCallToAction();
    sections.push(cta);

    // 6. Links section
    if (links.length > 0) {
      const linksSection = this.formatLinks(links);
      sections.push(linksSection);
    }

    // 7. Social links
    if (Object.keys(socialLinks).length > 0) {
      const socialSection = this.formatSocialLinks(socialLinks);
      sections.push(socialSection);
    }

    // 8. SEO keywords paragraph
    const seoSection = this.generateSEOParagraph(concept, keywordList);
    sections.push(seoSection);

    // 9. Hashtags
    let hashtags = [];
    if (includeHashtags) {
      hashtags = this.generateHashtags(concept, keywordList);
      sections.push('\n' + hashtags.join(' '));
    }

    // Combine all sections
    const fullDescription = sections.join('\n\n');

    // Analyze the description
    const analysis = this.analyzeDescription(fullDescription, keywordList);

    return {
      title,
      concept,
      generatedAt: new Date().toISOString(),
      description: fullDescription,
      sections: {
        hook,
        overview,
        keyPoints,
        timestamps: timestamps.length > 0 ? this.formatTimestamps(timestamps) : 'Generated placeholders',
        callToAction: cta,
        seoKeywords: seoSection
      },
      hashtags,
      analysis,
      recommendations: this.generateRecommendations(analysis),
      seoTips: [
        'First 150 characters appear in search results - front-load keywords',
        'Include 2-3 relevant links to boost authority',
        'Use timestamps to improve watch time and SEO',
        'Add 3-5 relevant hashtags at the end',
        'Include a clear call-to-action for engagement'
      ]
    };
  }

  generateHook(title, concept, contentStyle, keywords) {
    const hooks = {
      tutorial: `In this comprehensive ${concept} tutorial, you'll learn everything you need to get started and master the fundamentals.`,
      review: `Is ${concept} worth your time and money? In this honest review, I share my real experience and help you decide.`,
      vlog: `Join me as I explore ${concept} and share my journey with you. This is going to be exciting!`,
      entertainment: `Get ready for an amazing ${concept} experience! You won't want to miss what happens next.`,
      educational: `Want to understand ${concept}? This video breaks down everything in simple terms anyone can follow.`
    };

    const hookText = hooks[contentStyle] || hooks.tutorial;
    const keyword = keywords[0] || concept;

    return `${title}\n\n${hookText}`;
  }

  generateOverview(concept, contentStyle, targetAudience, keywords) {
    const audienceText = targetAudience !== 'general'
      ? `Perfect for ${targetAudience}, this `
      : 'This ';

    const styleDescriptions = {
      tutorial: 'step-by-step guide',
      review: 'in-depth review',
      vlog: 'personal vlog',
      entertainment: 'video',
      educational: 'educational breakdown'
    };

    const style = styleDescriptions[contentStyle] || 'video';

    let overview = `${audienceText}${style} covers:\n`;
    overview += `* The fundamentals of ${concept}\n`;
    overview += `* Practical tips you can apply immediately\n`;
    overview += `* Common mistakes to avoid\n`;
    overview += `* Pro tips from real experience`;

    return overview;
  }

  generateKeyPoints(concept, contentStyle) {
    const points = {
      tutorial: [
        'Complete setup and configuration',
        'Step-by-step walkthrough',
        'Best practices and tips',
        'Troubleshooting common issues',
        'Advanced techniques'
      ],
      review: [
        'Pros and cons breakdown',
        'Real-world performance',
        'Value for money analysis',
        'Comparison with alternatives',
        'Final verdict'
      ],
      educational: [
        'Core concepts explained',
        'Real-world examples',
        'Key takeaways',
        'Further learning resources',
        'Practice exercises'
      ]
    };

    const keyPoints = points[contentStyle] || points.tutorial;
    return 'WHAT YOU\'LL LEARN:\n' + keyPoints.map(p => `* ${p}`).join('\n');
  }

  formatTimestamps(timestamps) {
    const formatted = timestamps.map(ts => `${ts.time} - ${ts.label}`).join('\n');
    return `TIMESTAMPS:\n${formatted}`;
  }

  generatePlaceholderTimestamps(contentStyle) {
    const placeholders = {
      tutorial: [
        '0:00 - Introduction',
        '1:30 - Getting Started',
        '5:00 - Main Tutorial',
        '12:00 - Tips & Tricks',
        '15:00 - Conclusion'
      ],
      review: [
        '0:00 - Introduction',
        '1:00 - Unboxing/Overview',
        '3:00 - Features',
        '7:00 - Performance',
        '10:00 - Final Verdict'
      ],
      educational: [
        '0:00 - Introduction',
        '2:00 - Core Concepts',
        '8:00 - Examples',
        '12:00 - Summary',
        '14:00 - Next Steps'
      ]
    };

    const timestamps = placeholders[contentStyle] || placeholders.tutorial;
    return `TIMESTAMPS:\n${timestamps.join('\n')}\n\n(Update with actual timestamps after editing)`;
  }

  generateCallToAction() {
    return `----------------------------------------

LIKE this video if you found it helpful!
SUBSCRIBE and hit the notification bell for more content!
COMMENT below with your questions or thoughts!
SHARE with someone who might benefit!

----------------------------------------`;
  }

  formatLinks(links) {
    const formatted = links.map((link, i) => `${link}`).join('\n');
    return `RESOURCES & LINKS:\n${formatted}`;
  }

  formatSocialLinks(socialLinks) {
    const icons = {
      twitter: 'Twitter',
      instagram: 'Instagram',
      tiktok: 'TikTok',
      discord: 'Discord',
      website: 'Website',
      github: 'GitHub',
      linkedin: 'LinkedIn',
      facebook: 'Facebook'
    };

    const formatted = Object.entries(socialLinks)
      .map(([platform, url]) => `${icons[platform] || platform}: ${url}`)
      .join('\n');

    return `CONNECT WITH ME:\n${formatted}`;
  }

  generateSEOParagraph(concept, keywords) {
    const uniqueKeywords = [...new Set(keywords)].slice(0, 8);
    const keywordText = uniqueKeywords.join(', ');

    return `----------------------------------------

This video about ${concept} covers topics including: ${keywordText}. Whether you're just getting started or looking to improve your skills, this content will help you achieve your goals.`;
  }

  generateHashtags(concept, keywords) {
    const hashtags = new Set();

    // Add concept-based hashtag
    hashtags.add('#' + concept.replace(/\s+/g, '').toLowerCase());

    // Add keyword-based hashtags
    keywords.slice(0, 5).forEach(kw => {
      const tag = '#' + kw.replace(/\s+/g, '').toLowerCase();
      if (tag.length <= 30) {
        hashtags.add(tag);
      }
    });

    // Add common YouTube hashtags
    hashtags.add('#youtube');
    hashtags.add('#tutorial');

    return Array.from(hashtags).slice(0, 8);
  }

  analyzeDescription(description, keywords) {
    const analysis = {
      totalLength: description.length,
      wordCount: description.split(/\s+/).length,
      lineCount: description.split('\n').length,
      keywordsFound: [],
      keywordDensity: 0,
      hasTimestamps: description.includes('TIMESTAMPS'),
      hasCallToAction: description.includes('SUBSCRIBE') || description.includes('LIKE'),
      hasHashtags: description.includes('#'),
      hasLinks: description.includes('http') || description.includes('LINKS'),
      seoScore: 0
    };

    // Check keyword presence
    keywords.forEach(kw => {
      const regex = new RegExp(kw, 'gi');
      const matches = description.match(regex);
      if (matches) {
        analysis.keywordsFound.push({ keyword: kw, count: matches.length });
      }
    });

    // Calculate keyword density
    const totalKeywordOccurrences = analysis.keywordsFound.reduce((sum, k) => sum + k.count, 0);
    analysis.keywordDensity = ((totalKeywordOccurrences / analysis.wordCount) * 100).toFixed(2);

    // Calculate SEO score
    let score = 40; // Base score

    // Length (optimal: 200-5000 characters)
    if (analysis.totalLength >= 200 && analysis.totalLength <= 5000) score += 15;
    else if (analysis.totalLength > 5000) score += 10;

    // Keywords
    if (analysis.keywordsFound.length >= 3) score += 15;
    else if (analysis.keywordsFound.length >= 1) score += 10;

    // Structure elements
    if (analysis.hasTimestamps) score += 10;
    if (analysis.hasCallToAction) score += 10;
    if (analysis.hasHashtags) score += 5;
    if (analysis.hasLinks) score += 5;

    analysis.seoScore = Math.min(100, score);
    analysis.rating = analysis.seoScore >= 80 ? 'excellent' :
                      analysis.seoScore >= 60 ? 'good' :
                      analysis.seoScore >= 40 ? 'fair' : 'needs improvement';

    return analysis;
  }

  generateRecommendations(analysis) {
    const recommendations = [];

    if (analysis.totalLength < 200) {
      recommendations.push('Add more content - descriptions under 200 characters may hurt SEO');
    }

    if (analysis.keywordsFound.length < 3) {
      recommendations.push('Include more relevant keywords naturally throughout the description');
    }

    if (!analysis.hasTimestamps) {
      recommendations.push('Add timestamps to improve user experience and SEO');
    }

    if (!analysis.hasCallToAction) {
      recommendations.push('Include a clear call-to-action (subscribe, like, comment)');
    }

    if (!analysis.hasHashtags) {
      recommendations.push('Add 3-5 relevant hashtags at the end');
    }

    if (analysis.keywordDensity > 5) {
      recommendations.push('Reduce keyword density - current level may appear spammy');
    }

    if (recommendations.length === 0) {
      recommendations.push('Great job! Your description is well-optimized');
    }

    return recommendations;
  }
}

// Start the server
const server = new YTDescriptionWriter();
server.start();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing WebSocket server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing WebSocket server');
  process.exit(0);
});
