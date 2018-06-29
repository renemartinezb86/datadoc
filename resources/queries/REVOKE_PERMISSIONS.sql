WITH RECURSIVE revoke_permissions(child, root) AS (
  select user_id, parent_user_id
  from user_file_share
  where parent_user_id = [[${userForRevoke}]] and datadoc_id = [[${datadocId}]]
  UNION
  SELECT
    ufs.user_id, ufs.parent_user_id
  FROM user_file_share ufs, revoke_permissions rp where ufs.parent_user_id = rp.child
)
select rp.*, u.email
from revoke_permissions rp
join "user" as u on rp.root = u.id;