
/**
 * Assign user role
 *
 * @param userId the user id
 * @param groupName the group name
 */
async function assignRole (userId, groupName) {
  // TODO: assign user role from group
  console.log(`Need assign user ${userId} to group ${groupName}`)
}

/**
 * Remove user role
 *
 * @param userId the user id
 * @param groupName the group name
 */
async function removeRole (userId, groupName) {
  // TODO: remove user role from group
  console.log(`Need remove user ${userId} from group ${groupName}`)
}

/**
 * Remove user permission from forum category
 *
 * @param userId the user id
 * @param forumCategoryId the forum category id
 */
async function removeUserPermission (userId, forumCategoryId) {
  // TODO: need remove user permission from group
  console.log(`Need remove user ${userId} permission from forum category ${forumCategoryId}`)
}

/**
 * Create category watch
 *
 * @param userId the user id
 * @param forumCategoryId the forum category id
 */
async function createCategoryWatch (userId, forumCategoryId) {
// TODO: need create category watch for user
  console.log(`Need create category watch for user ${userId} to forum category ${forumCategoryId}`)
}

/**
 * Delete category watch
 *
 * @param userId the user id
 * @param forumCategoryId the forum category id
 */
async function deleteCategoryWatch (userId, forumCategoryId) {
// TODO: need delete category watch for user
  console.log(`Need delete category watch for user ${userId} from forum category ${forumCategoryId}`)
}

module.exports = {
  assignRole,
  removeRole,
  removeUserPermission,
  createCategoryWatch,
  deleteCategoryWatch
}
