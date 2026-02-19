// utils/aggregations.js - Fast pagination
export const paginatedAggregation = (filters, page = 1, limit = 12, sort = { trending_score: -1 }) => {
  const pipeline = [
    { $match: { ...filters, active: true, status: 'active', deletedAt: null } },
    { $sort: sort },
    { $skip: (page - 1) * limit },
    { $limit: limit },
    {
      $lookup: {
        from: 'marketplaceproducts',
        let: { id: '$_id' },
        pipeline: [{ $match: { $expr: { $eq: ['$poster_id', '$$id'] } } }],
        as: 'sellerProducts'
      }
    },
    { $addFields: { discount_percent: { $round: [{ $multiply: [{ $subtract: ['$price_num', { $ifNull: ['$discount_num', '$price_num'] } ] }, 100 / '$price_num'] }, 0] } } }
  ];
  
  return pipeline;
};
