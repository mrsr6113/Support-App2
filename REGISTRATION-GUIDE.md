# Troubleshooting Entry Registration Guide

This guide explains how to use the troubleshooting entry registration system to add new knowledge to the multimodal RAG system.

## Overview

The registration system allows you to:
- Upload images of product issues
- Provide detailed descriptions and solutions
- Automatically generate vector embeddings
- Store entries in the knowledge base
- Handle batch registrations
- Validate all input data

## Getting Started

### 1. Access the Registration Form
Navigate to `/register-entries` to access the registration interface.

### 2. Basic Entry Structure
Each troubleshooting entry requires:
- **Image**: Photo showing the product issue
- **Icon Name**: Short, descriptive name
- **Icon Description**: Detailed explanation
- **Troubleshooting Content**: Step-by-step solution

### 3. Required Fields
- ✅ **Image**: JPG, PNG, or WebP (max 10MB)
- ✅ **Icon Name**: 3-200 characters
- ✅ **Icon Description**: 10-1000 characters  
- ✅ **Content**: 20-10,000 characters

## Image Guidelines

### Supported Formats
- **JPEG/JPG**: Best for photographs
- **PNG**: Best for screenshots and graphics
- **WebP**: Modern format with good compression

### Image Quality Tips
- **Resolution**: Minimum 300x300 pixels recommended
- **Clarity**: Ensure the issue is clearly visible
- **Lighting**: Good lighting helps AI analysis
- **Focus**: Keep the problem area in focus
- **Context**: Include enough surrounding context

### What Makes a Good Troubleshooting Image
1. **Clear Problem Visibility**: The issue should be obvious
2. **Proper Framing**: Don't crop too tightly
3. **Good Contrast**: Indicators should stand out
4. **Multiple Angles**: Consider different perspectives
5. **Before/After**: Show normal vs. problem states

## Content Writing Best Practices

### Icon Name
- Be specific and descriptive
- Use standard terminology
- Include the component name
- Example: "Waste Container Full Indicator"

### Icon Description
- Explain what the indicator looks like
- Describe normal vs. abnormal states
- Include color, pattern, location details
- Mention what triggers the indicator

### Troubleshooting Content
- Start with immediate safety concerns
- Use numbered steps for clarity
- Include verification steps
- Mention when to seek professional help
- Be specific about tools needed

## Classification Guidelines

### Issue Types
- **Visual Indicator**: LED lights, displays, status indicators
- **Physical Damage**: Cracks, wear, corrosion, breaks
- **Malfunction**: Performance issues, operational problems
- **Maintenance**: Routine care, cleaning, replacement

### Severity Levels
- **Critical**: Safety risk, immediate action required
- **High**: Significant impact, urgent attention needed
- **Medium**: Moderate impact, should be addressed soon
- **Low**: Minor issue, can be scheduled

### Difficulty Levels
- **Beginner**: No special skills required
- **Intermediate**: Basic technical knowledge needed
- **Advanced**: Significant expertise required
- **Expert**: Professional service recommended

## Batch Registration

### Adding Multiple Entries
1. Click "Add Entry" for each new entry
2. Fill out all required fields
3. Validate entries before submission
4. Submit all valid entries at once

### Import/Export Features
- **Export**: Save entries as JSON for backup
- **Import**: Load previously saved entries
- **Examples**: Load sample entries to get started

## Validation and Error Handling

### Real-time Validation
- Entries are validated as you type
- Red borders indicate errors
- Green borders indicate valid entries
- Error messages appear immediately

### Common Validation Errors
- Missing required fields
- Invalid image format
- Content too short or too long
- Invalid time estimates

### Submission Process
1. Only valid entries are submitted
2. Each entry is processed individually
3. Results show success/failure for each
4. Failed entries remain in the form
5. Successful entries are removed

## AI-Enhanced Features

### Automatic Tag Generation
The system automatically extracts:
- Visual indicator types
- Indicator states and colors
- Relevant keywords for search

### Image Embedding
- Images are converted to 1408-dimension vectors
- Enables similarity search in the knowledge base
- Powered by Google's multimodal embedding API

### Content Analysis
- AI analyzes your descriptions
- Suggests improvements and tags
- Identifies missing information

## Tips for Success

### Before You Start
1. Gather all relevant images
2. Have product documentation ready
3. Test the troubleshooting steps yourself
4. Consider different user skill levels

### During Registration
1. Use the examples as templates
2. Validate entries before submitting
3. Review error messages carefully
4. Save your work frequently (export)

### After Registration
1. Test the entries in the main system
2. Check similarity search results
3. Update entries if needed
4. Monitor user feedback

## Troubleshooting the Registration System

### Common Issues
- **Image Upload Fails**: Check file size and format
- **Validation Errors**: Review required fields
- **Submission Timeout**: Try smaller batches
- **Network Errors**: Check internet connection

### Getting Help
- Check the Examples tab for guidance
- Review validation error messages
- Export your work before troubleshooting
- Contact support if issues persist

## Best Practices Summary

1. **Quality Over Quantity**: Better to have fewer high-quality entries
2. **User-Focused**: Write for the end user, not technicians
3. **Safety First**: Always prioritize safety warnings
4. **Test Everything**: Verify your troubleshooting steps work
5. **Keep Updated**: Review and update entries regularly

## Integration with Main System

### How Entries Are Used
1. Images are analyzed for visual similarity
2. Text content is searched for keywords
3. AI combines both for comprehensive matching
4. Results are ranked by relevance and severity

### Knowledge Base Impact
- New entries immediately available for search
- Improves system accuracy over time
- Helps identify knowledge gaps
- Enables better user support

This registration system is designed to be user-friendly while maintaining high data quality standards. Take your time to create comprehensive, accurate entries that will help users solve their product issues effectively.
