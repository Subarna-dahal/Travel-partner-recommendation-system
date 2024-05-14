// recomanded.js

const cosineSimilarity = require('cosine-similarity');

function calculateCosineSimilarity(vector1, vector2) {
  return cosineSimilarity(vector1, vector2);
}

function recommendCards(userProfile, cardData) {
  const userVector = [userProfile.age, userProfile.budget];
  const recommendations = [];

  for (const card of cardData) {
    const cardVector = [card.age, card.budget];
    const similarity = calculateCosineSimilarity(userVector, cardVector);

    recommendations.push({ card, similarity });
  }

  recommendations.sort((a, b) => b.similarity - a.similarity);

  return recommendations;
}

module.exports = recommendCards;
