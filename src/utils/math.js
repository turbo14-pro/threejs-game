/**
 * Calculates the rotation for an object based on elapsed time.
 * @param {number} elapsedTime 
 * @param {number} speed 
 * @returns {number}
 */
export const calculateRotation = (elapsedTime, speed = 1) => {
    return elapsedTime * speed;
};
